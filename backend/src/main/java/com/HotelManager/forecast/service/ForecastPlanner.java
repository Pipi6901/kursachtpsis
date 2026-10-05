package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.dto.ModelInfoDto;
import com.HotelManager.forecast.dto.ScenarioRequest;
import com.HotelManager.forecast.dto.ScenarioType;
import com.HotelManager.forecast.entity.ForecastModel;
import com.HotelManager.forecast.entity.ForecastModelChannelEffect;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.entity.ModelStatus;
import com.HotelManager.forecast.exception.ForecastException;
import com.HotelManager.forecast.repo.ForecastModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Подготовка расчётов по активной модели: недели прогноза, плановые затраты по каналам, применение
 * сценария. Здесь собрана вся «классическая» логика (даты, затраты, сценарии) — ML-сервис получает
 * только готовую матрицу затрат.
 */
@Component
@RequiredArgsConstructor
public class ForecastPlanner {

    static final double MAX_MULTIPLIER = 10.0;
    static final double MAX_WEEKLY_SPEND = 10_000_000.0;

    private final ForecastModelRepository models;
    private final ForecastDataService data;

    /** Неизменяемый «снимок» модели и данных на момент расчёта (без ленивых связей JPA). */
    public record Context(Long modelId, String externalId, ForecastTarget target,
                          String algorithm, String algorithmLabel, LocalDateTime trainedAt, LocalDate dataTo,
                          Double wape, Double mape, String fingerprint, boolean stale,
                          List<String> channelCodes, Map<String, ForecastModelChannelEffect> effects,
                          Dataset history, LocalDate origin) {

        /** Недели между концом обучения и началом прогноза (затраты по ним известны фактически). */
        public int gapWeeks() {
            return (int) ChronoUnit.WEEKS.between(dataTo, origin) - 1;
        }

        public ModelInfoDto info() {
            return new ModelInfoDto(modelId, externalId, algorithm, algorithmLabel, trainedAt, dataTo, wape, mape,
                    stale);
        }
    }

    @Transactional(readOnly = true)
    public Context activeContext(ForecastTarget target) {
        ForecastModel model = models.findFirstByTargetAndStatusOrderByTrainedAtDesc(target, ModelStatus.ACTIVE)
                .orElseThrow(() -> ForecastException.conflict("Модель для показателя «" + target.getTitle()
                        + "» ещё не обучена. Обучите её на странице «Модель и данные»."));
        return contextOf(model);
    }

    @Transactional(readOnly = true)
    public Context contextFor(Long modelId) {
        ForecastModel model = models.findById(modelId)
                .orElseThrow(() -> ForecastException.notFound("Модель не найдена."));
        return contextOf(model);
    }

    private Context contextOf(ForecastModel model) {
        Dataset history = data.trainingDataset(model.getTarget());
        LocalDate origin = history.lastWeek().plusWeeks(1);
        if (!origin.isAfter(model.getDataTo())) {
            throw ForecastException.conflict("Данные продаж изменились (удалены недели после обучения модели). "
                    + "Переобучите модель.");
        }
        Map<String, ForecastModelChannelEffect> effects = new LinkedHashMap<>();
        for (ForecastModelChannelEffect e : model.getEffects()) {
            effects.put(e.getChannel().getCode(), e);
        }
        boolean stale = !DatasetAssembler.fingerprint(history).equals(model.getDataFingerprint());
        return new Context(model.getId(), model.getExternalId(), model.getTarget(), model.getAlgorithm(),
                model.getAlgorithmLabel(), model.getTrainedAt(), model.getDataTo(), model.getWape(), model.getMape(),
                model.getDataFingerprint(), stale, new ArrayList<>(effects.keySet()), effects, history, origin);
    }

    /** План затрат на недели от конца обучения до конца горизонта: [gap недель факта] + [горизонт]. */
    public double[][] planMatrix(Context ctx, int horizonWeeks) {
        return data.spendFor(ctx.dataTo().plusWeeks(1), ctx.gapWeeks() + horizonWeeks, ctx.channelCodes());
    }

    /** Возвращает копию матрицы, в которой сценарий применён только к неделям горизонта. */
    public double[][] applyScenario(Context ctx, double[][] plan, ScenarioRequest scenario) {
        double[][] result = new double[plan.length][];
        for (int i = 0; i < plan.length; i++) {
            result[i] = plan[i].clone();
        }
        ScenarioType type = scenario.type();
        if (type == ScenarioType.PLAN) {
            return result;
        }
        int gap = ctx.gapWeeks();
        if (type == ScenarioType.NO_MARKETING) {
            for (int i = gap; i < result.length; i++) {
                java.util.Arrays.fill(result[i], 0.0);
            }
            return result;
        }
        Map<String, Double> multipliers = scenario.multipliers() == null ? Map.of() : scenario.multipliers();
        Map<String, Double> weekly = scenario.weeklySpend() == null ? Map.of() : scenario.weeklySpend();
        for (String code : multipliers.keySet()) {
            requireKnown(ctx, code);
        }
        for (String code : weekly.keySet()) {
            requireKnown(ctx, code);
        }
        for (int c = 0; c < ctx.channelCodes().size(); c++) {
            String code = ctx.channelCodes().get(c);
            Double fixed = weekly.get(code);
            Double factor = multipliers.get(code);
            if (fixed != null && (fixed < 0 || fixed > MAX_WEEKLY_SPEND || fixed.isNaN())) {
                throw ForecastException.badRequest("Недельные затраты канала «" + code + "» вне допустимого диапазона.");
            }
            if (factor != null && (factor < 0 || factor > MAX_MULTIPLIER || factor.isNaN())) {
                throw ForecastException.badRequest("Множитель канала «" + code + "» должен быть от 0 до "
                        + (int) MAX_MULTIPLIER + ".");
            }
            for (int i = gap; i < result.length; i++) {
                if (fixed != null) {
                    result[i][c] = fixed;
                } else if (factor != null) {
                    result[i][c] *= factor;
                }
            }
        }
        return result;
    }

    private void requireKnown(Context ctx, String code) {
        if (!ctx.channelCodes().contains(code)) {
            throw ForecastException.badRequest("В сценарии указан канал «" + code
                    + "», которого нет в модели (канал добавлен после обучения или не существует).");
        }
    }

    /** Строки затрат для обмена с ML-сервисом: недели подряд начиная с {@code first}. */
    public static List<AiContract.SpendRow> rows(LocalDate first, double[][] matrix, List<String> codes) {
        List<AiContract.SpendRow> rows = new ArrayList<>(matrix.length);
        for (int i = 0; i < matrix.length; i++) {
            Map<String, Double> spend = new LinkedHashMap<>();
            for (int c = 0; c < codes.size(); c++) {
                spend.put(codes.get(c), Math.round(matrix[i][c] * 100.0) / 100.0);
            }
            rows.add(new AiContract.SpendRow(first.plusWeeks(i), spend));
        }
        return rows;
    }

    public static String hash(List<AiContract.SpendRow> rows) {
        StringBuilder sb = new StringBuilder();
        for (AiContract.SpendRow row : rows) {
            sb.append(row.weekStart());
            row.spend().forEach((k, v) -> sb.append(';').append(k).append('=').append(String.format(Locale.ROOT, "%.2f", v)));
            sb.append('\n');
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
