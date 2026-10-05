package com.HotelManager.forecast.service;

import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.entity.MarketingCampaign;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.entity.SalesWeekly;
import com.HotelManager.forecast.exception.ForecastException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Сборка обучающего набора из фактических продаж и маркетинговых кампаний. Это классическая
 * бизнес-логика серверной части: ML-сервис получает уже готовый выровненный набор.
 *
 * <p>Недельные затраты канала: бюджет каждой кампании равномерно распределяется по дням её периода,
 * затем суммируется по дням каждой недели (понедельник — воскресенье).
 */
public final class DatasetAssembler {

    /** Минимум недель истории для обучения (год сезонности + окно проверки). */
    public static final int MIN_WEEKS = 64;
    /** Наибольший пропуск в ряду продаж, который восстанавливается интерполяцией. */
    public static final int MAX_GAP_WEEKS = 4;

    private DatasetAssembler() {
    }

    public static Dataset assemble(ForecastTarget target, List<SalesWeekly> sales,
                                   List<MarketingCampaign> campaigns, List<MarketingChannel> activeChannels) {
        if (sales.isEmpty()) {
            throw ForecastException.badRequest("Нет данных о продажах: загрузите историю продаж по неделям.");
        }
        List<SalesWeekly> sorted = sales.stream().sorted(Comparator.comparing(SalesWeekly::getWeekStart)).toList();
        for (SalesWeekly s : sorted) {
            if (s.getWeekStart().getDayOfWeek() != DayOfWeek.MONDAY) {
                throw ForecastException.badRequest("Неделя " + s.getWeekStart() + " не начинается с понедельника.");
            }
        }
        LocalDate first = sorted.get(0).getWeekStart();
        LocalDate last = sorted.get(sorted.size() - 1).getWeekStart();
        int n = (int) ChronoUnit.WEEKS.between(first, last) + 1;

        Double[] raw = new Double[n];
        for (SalesWeekly s : sorted) {
            raw[(int) ChronoUnit.WEEKS.between(first, s.getWeekStart())] = value(target, s);
        }
        List<String> warnings = new ArrayList<>();
        double[] values = fillGaps(raw, first, warnings);

        List<LocalDate> weeks = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            weeks.add(first.plusWeeks(i));
        }
        List<String> codes = activeChannels.stream().map(MarketingChannel::getCode).toList();
        if (codes.isEmpty()) {
            throw ForecastException.badRequest("Нет активных маркетинговых каналов.");
        }
        long skipped = campaigns.stream().filter(c -> !codes.contains(c.getChannel().getCode())).count();
        if (skipped > 0) {
            warnings.add("Кампании неактивных каналов (" + skipped + ") в расчёте не учитываются.");
        }
        double[][] spend = spendMatrix(weeks, campaigns, codes);
        if (n < MIN_WEEKS) {
            throw ForecastException.badRequest("Для обучения нужно не менее " + MIN_WEEKS
                    + " недель истории продаж, сейчас — " + n + ".");
        }
        return new Dataset(weeks, values, codes, spend, warnings);
    }

    private static double value(ForecastTarget target, SalesWeekly s) {
        return target == ForecastTarget.REVENUE ? s.getRevenue().doubleValue() : s.getBookings();
    }

    /** Пропуски до {@link #MAX_GAP_WEEKS} недель восстанавливаются линейной интерполяцией. */
    private static double[] fillGaps(Double[] raw, LocalDate first, List<String> warnings) {
        double[] out = new double[raw.length];
        int filled = 0;
        int i = 0;
        while (i < raw.length) {
            if (raw[i] != null) {
                out[i] = raw[i];
                i++;
                continue;
            }
            int start = i;
            while (i < raw.length && raw[i] == null) {
                i++;
            }
            int gap = i - start;
            if (gap > MAX_GAP_WEEKS) {
                throw ForecastException.badRequest("В ряду продаж пропущено " + gap + " нед. подряд (с "
                        + first.plusWeeks(start) + " по " + first.plusWeeks(i - 1) + "), допустимо не более "
                        + MAX_GAP_WEEKS + ". Загрузите недостающие данные.");
            }
            double left = raw[start - 1];   // начало и конец ряда всегда заполнены, поэтому соседи существуют
            double right = raw[i];
            for (int k = 0; k < gap; k++) {
                out[start + k] = left + (right - left) * (k + 1) / (gap + 1);
            }
            filled += gap;
        }
        if (filled > 0) {
            warnings.add("Пропущенных недель восстановлено интерполяцией: " + filled + ".");
        }
        return out;
    }

    /**
     * Недельные затраты по каналам для заданных недель. Строка — неделя, столбец — канал в порядке
     * {@code channelCodes}; кампании каналов вне списка игнорируются.
     */
    public static double[][] spendMatrix(List<LocalDate> weeks, List<MarketingCampaign> campaigns,
                                         List<String> channelCodes) {
        double[][] spend = new double[weeks.size()][channelCodes.size()];
        if (weeks.isEmpty()) {
            return spend;
        }
        Map<String, Integer> columns = new HashMap<>();
        for (int c = 0; c < channelCodes.size(); c++) {
            columns.put(channelCodes.get(c), c);
        }
        LocalDate first = weeks.get(0);
        for (MarketingCampaign campaign : campaigns) {
            Integer column = columns.get(campaign.getChannel().getCode());
            if (column == null) {
                continue;
            }
            LocalDate start = campaign.getStartDate();
            LocalDate end = campaign.getEndDate();
            long days = ChronoUnit.DAYS.between(start, end) + 1;
            double daily = campaign.getBudget().doubleValue() / days;
            long from = Math.max(0, Math.floorDiv(ChronoUnit.DAYS.between(first, start), 7));
            long to = Math.min(weeks.size() - 1, Math.floorDiv(ChronoUnit.DAYS.between(first, end), 7));
            for (long w = from; w <= to; w++) {
                LocalDate weekStart = weeks.get((int) w);
                LocalDate weekEnd = weekStart.plusDays(6);
                LocalDate overlapStart = start.isAfter(weekStart) ? start : weekStart;
                LocalDate overlapEnd = end.isBefore(weekEnd) ? end : weekEnd;
                long overlap = ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;
                if (overlap > 0) {
                    spend[(int) w][column] += daily * overlap;
                }
            }
        }
        return spend;
    }

    /** Отпечаток данных (SHA-256): по нему определяется, что модель обучена на устаревших данных. */
    public static String fingerprint(Dataset dataset) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", dataset.channelCodes())).append('\n');
        for (int i = 0; i < dataset.size(); i++) {
            sb.append(dataset.weeks().get(i)).append(';').append(String.format(Locale.ROOT, "%.2f", dataset.sales()[i]));
            for (double v : dataset.spend()[i]) {
                sb.append(';').append(String.format(Locale.ROOT, "%.2f", v));
            }
            sb.append('\n');
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
