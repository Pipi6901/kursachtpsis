package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Рекомендация по распределению бюджета между каналами. */
public record OptimizationDto(
        String target, String targetTitle, int horizonWeeks, LocalDate originWeek, double totalBudget,
        double spentBudget, double planBudget, double planMarketingEffect, double optimizedMarketingEffect,
        double upliftAbs, Double upliftPct, List<Allocation> allocations,
        /** Готовый сценарий «применить рекомендацию»: постоянные недельные затраты по кодам каналов. */
        Map<String, Double> suggestedWeeklySpend, List<String> notes) {

    public record Allocation(String code, String name, double planSpend, double recommendedSpend,
                             double weeklySpend, double share, double planEffect, double expectedEffect,
                             double marginalReturn) {
    }
}
