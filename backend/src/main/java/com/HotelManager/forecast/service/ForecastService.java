package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.ai.AiRequestException;
import com.HotelManager.forecast.ai.AiUnavailableException;
import com.HotelManager.forecast.ai.ForecastAiGateway;
import com.HotelManager.forecast.dto.PredictRequest;
import com.HotelManager.forecast.dto.PredictionDto;
import com.HotelManager.forecast.dto.ScenarioRequest;
import com.HotelManager.forecast.entity.ForecastModelChannelEffect;
import com.HotelManager.forecast.entity.MarketingChannel;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Прогноз продаж. Алгоритм: определить активную модель → собрать план затрат и применить сценарий →
 * получить прогноз у интеллектуального сервиса (с кэшем, предохранителем и повторными попытками) →
 * при его недоступности выдать упрощённый прогноз с пометкой «деградация» → дополнить результат
 * историей, сравнением с прошлыми периодами и сводкой по каналам.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForecastService {

    private static final int HISTORY_WEEKS = 26;

    private final ForecastPlanner planner;
    private final ForecastAiGateway gateway;
    private final AiForecastCache cache;
    private final ForecastDataService data;

    public PredictionDto predict(PredictRequest request) {
        ForecastPlanner.Context ctx = planner.activeContext(request.target());
        ScenarioRequest scenario = request.scenarioOrPlan();
        int horizon = request.horizonWeeks();
        double[][] plan = planner.planMatrix(ctx, horizon);
        double[][] scenarioSpend = planner.applyScenario(ctx, plan, scenario);

        LocalDate first = ctx.dataTo().plusWeeks(1);
        List<AiContract.SpendRow> rows = ForecastPlanner.rows(first, scenarioSpend, ctx.channelCodes());
        AiContract.ForecastRequest aiRequest = new AiContract.ForecastRequest(ctx.origin(), horizon, rows, null, true);

        List<String> warnings = new ArrayList<>();
        AiContract.ForecastResponse ai = null;
        String degradedReason = null;
        String key = ctx.externalId() + '|' + ctx.origin() + '|' + horizon + '|' + ForecastPlanner.hash(rows);
        try {
            ai = cache.get(key, () -> gateway.forecast(ctx.externalId(), aiRequest));
        } catch (AiUnavailableException | CallNotPermittedException e) {
            log.warn("Прогноз выполнен в режиме деградации: {}", e.getMessage());
            degradedReason = "Интеллектуальный сервис недоступен — показан упрощённый прогноз по сезонной "
                    + "модели без учёта маркетинга и сценариев.";
        } catch (AiRequestException e) {
            if (e.getStatus() != 404) {
                throw e;
            }
            degradedReason = "Модель отсутствует в реестре интеллектуального сервиса — показан упрощённый "
                    + "прогноз. Переобучите модель.";
        }

        List<PredictionDto.Point> points = new ArrayList<>(horizon);
        double totalPredicted = 0;
        double totalLower = 0;
        double totalUpper = 0;
        double totalSpend = 0;
        Double totalBase = null;
        Map<String, Double> contributionTotals = new HashMap<>();
        double intervalLevel;
        int gap = ctx.gapWeeks();

        if (ai != null) {
            intervalLevel = ai.intervalLevel();
            for (int i = 0; i < ai.points().size(); i++) {
                AiContract.ForecastPoint p = ai.points().get(i);
                Map<String, Double> spend = spendMap(ctx.channelCodes(), scenarioSpend[gap + i]);
                points.add(new PredictionDto.Point(p.weekStart(), p.predicted(), p.lower(), p.upper(), p.base(),
                        p.contributions(), spend));
                totalPredicted += p.predicted();
                totalLower += p.lower();
                totalUpper += p.upper();
                totalSpend += spend.values().stream().mapToDouble(Double::doubleValue).sum();
                if (p.base() != null) {
                    totalBase = (totalBase == null ? 0 : totalBase) + p.base();
                }
                if (p.contributions() != null) {
                    p.contributions().forEach((code, v) -> contributionTotals.merge(code, v, Double::sum));
                }
            }
        } else {
            intervalLevel = 0.0;
            List<FallbackForecaster.Point> fallback = FallbackForecaster.forecast(ctx.history().sales(),
                    ctx.origin(), horizon);
            for (int i = 0; i < fallback.size(); i++) {
                FallbackForecaster.Point p = fallback.get(i);
                Map<String, Double> spend = spendMap(ctx.channelCodes(), scenarioSpend[gap + i]);
                points.add(new PredictionDto.Point(p.weekStart(), p.predicted(), p.lower(), p.upper(), null, null, spend));
                totalPredicted += p.predicted();
                totalLower += p.lower();
                totalUpper += p.upper();
                totalSpend += spend.values().stream().mapToDouble(Double::doubleValue).sum();
            }
        }
        if (ctx.stale()) {
            warnings.add("Данные изменились после обучения модели — рекомендуется переобучить её.");
        }
        List<MarketingChannel> extraChannels = extraActiveChannels(ctx);
        if (!extraChannels.isEmpty()) {
            warnings.add("Каналы, добавленные после обучения, пока не учитываются: "
                    + String.join(", ", extraChannels.stream().map(MarketingChannel::getName).toList()) + ".");
        }

        double[] hist = ctx.history().sales();
        int n = hist.length;
        Double previous = n >= horizon ? sum(hist, n - horizon, n) : null;
        Double lastYear = n - 52 >= 0 ? sum(hist, n - 52, n - 52 + horizon) : null;

        PredictionDto.Totals totals = new PredictionDto.Totals(totalPredicted, totalLower, totalUpper, totalBase,
                totalSpend, previous, change(totalPredicted, previous), lastYear, change(totalPredicted, lastYear));
        return new PredictionDto(request.target().name(), request.target().getTitle(), horizon, ctx.origin(),
                scenario.type().name(), ctx.info(), ai == null, degradedReason, intervalLevel, points,
                historyPoints(ctx), totals, channelSummary(ctx, scenarioSpend, contributionTotals, totalPredicted,
                ai != null), warnings);
    }

    private List<PredictionDto.HistoryPoint> historyPoints(ForecastPlanner.Context ctx) {
        Dataset h = ctx.history();
        int from = Math.max(0, h.size() - HISTORY_WEEKS);
        List<PredictionDto.HistoryPoint> out = new ArrayList<>();
        for (int i = from; i < h.size(); i++) {
            out.add(new PredictionDto.HistoryPoint(h.weeks().get(i), h.sales()[i]));
        }
        return out;
    }

    private List<PredictionDto.ChannelSummary> channelSummary(ForecastPlanner.Context ctx, double[][] spend,
                                                               Map<String, Double> contributions, double total,
                                                               boolean hasComponents) {
        Map<String, String> names = new HashMap<>();
        for (MarketingChannel ch : data.channelsByCodes(ctx.channelCodes())) {
            names.put(ch.getCode(), ch.getName());
        }
        int gap = ctx.gapWeeks();
        List<PredictionDto.ChannelSummary> out = new ArrayList<>();
        for (int c = 0; c < ctx.channelCodes().size(); c++) {
            String code = ctx.channelCodes().get(c);
            double planned = 0;
            for (int i = gap; i < spend.length; i++) {
                planned += spend[i][c];
            }
            ForecastModelChannelEffect effect = ctx.effects().get(code);
            Double contribution = hasComponents ? contributions.getOrDefault(code, 0.0) : null;
            out.add(new PredictionDto.ChannelSummary(code, names.getOrDefault(code, code), planned, contribution,
                    contribution != null && total > 0 ? contribution / total : null,
                    contribution != null && planned > 0 ? contribution / planned : null,
                    effect != null ? effect.getMarginalRoi() : null,
                    effect != null ? effect.getSaturationLevel() : null,
                    effect != null && effect.isLowVariation()));
        }
        return out;
    }

    private List<MarketingChannel> extraActiveChannels(ForecastPlanner.Context ctx) {
        return ctx.history().channelCodes().stream()
                .filter(code -> !ctx.channelCodes().contains(code))
                .flatMap(code -> data.channelsByCodes(List.of(code)).stream()).toList();
    }

    private static Map<String, Double> spendMap(List<String> codes, double[] row) {
        Map<String, Double> map = new LinkedHashMap<>();
        for (int c = 0; c < codes.size(); c++) {
            map.put(codes.get(c), row[c]);
        }
        return map;
    }

    private static double sum(double[] a, int from, int to) {
        double s = 0;
        for (int i = from; i < to; i++) {
            s += a[i];
        }
        return s;
    }

    private static Double change(double value, Double base) {
        return base == null || base == 0 ? null : value / base - 1.0;
    }
}
