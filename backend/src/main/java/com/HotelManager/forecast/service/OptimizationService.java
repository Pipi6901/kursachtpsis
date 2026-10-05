package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.ai.ForecastAiGateway;
import com.HotelManager.forecast.dto.OptimizationDto;
import com.HotelManager.forecast.dto.OptimizeRequestDto;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.exception.ForecastException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Рекомендация по распределению бюджета. Расчёт выполняет интеллектуальный сервис на кривых отклика
 * обученной модели; сервер готовит план, ограничения и интерпретирует результат. Рекомендация носит
 * совещательный характер: применить её как сценарий и оценить прогноз решает менеджер.
 */
@Service
@RequiredArgsConstructor
public class OptimizationService {

    private final ForecastPlanner planner;
    private final ForecastAiGateway gateway;
    private final ForecastDataService data;

    public OptimizationDto optimize(OptimizeRequestDto request) {
        ForecastPlanner.Context ctx = planner.activeContext(request.target());
        int horizon = request.horizonWeeks();
        double[][] plan = planner.planMatrix(ctx, horizon);
        double planBudget = 0;
        for (int i = ctx.gapWeeks(); i < plan.length; i++) {
            for (double v : plan[i]) {
                planBudget += v;
            }
        }
        double budget = request.totalBudget() != null ? request.totalBudget() : planBudget;
        if (budget <= 0) {
            throw ForecastException.badRequest("В плане нет запланированных затрат на выбранный период — "
                    + "укажите бюджет вручную.");
        }
        List<AiContract.Constraint> constraints = request.limits() == null ? List.of()
                : request.limits().stream().map(l -> {
            if (!ctx.channelCodes().contains(l.channelCode())) {
                throw ForecastException.badRequest("Канал «" + l.channelCode() + "» отсутствует в модели.");
            }
            if (l.minShare() > l.maxShare()) {
                throw ForecastException.badRequest("Минимальная доля канала не может превышать максимальную.");
            }
            return new AiContract.Constraint(l.channelCode(), l.minShare(), l.maxShare());
        }).toList();

        List<AiContract.SpendRow> rows = ForecastPlanner.rows(ctx.dataTo().plusWeeks(1), plan, ctx.channelCodes());
        AiContract.OptimizeResponse ai = gateway.optimize(ctx.externalId(),
                new AiContract.OptimizeRequest(ctx.origin(), horizon, budget, rows, constraints));

        Map<String, String> names = new HashMap<>();
        for (MarketingChannel ch : data.channelsByCodes(ctx.channelCodes())) {
            names.put(ch.getCode(), ch.getName());
        }
        Map<String, Double> suggested = new LinkedHashMap<>();
        List<OptimizationDto.Allocation> allocations = ai.allocations().stream().map(a -> {
            suggested.put(a.code(), Math.round(a.weeklySpend() * 100.0) / 100.0);
            return new OptimizationDto.Allocation(a.code(), names.getOrDefault(a.code(), a.code()),
                    a.planTotalSpend(), a.totalSpend(), a.weeklySpend(), a.share(), a.planEffect(),
                    a.expectedEffect(), a.marginalReturn());
        }).toList();
        return new OptimizationDto(request.target().name(), request.target().getTitle(), horizon, ctx.origin(),
                ai.totalBudget(), ai.spentBudget(), ai.planBudget(), ai.planMarketingEffect(),
                ai.optimizedMarketingEffect(), ai.upliftAbs(), ai.upliftPct(), allocations, suggested,
                ai.notes() == null ? List.of() : ai.notes());
    }
}
