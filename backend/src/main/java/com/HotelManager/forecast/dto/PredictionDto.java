package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Результат прогноза продаж. */
public record PredictionDto(
        String target, String targetTitle, int horizonWeeks, LocalDate originWeek, String scenarioType,
        ModelInfoDto model, boolean degraded, String degradedReason, double intervalLevel,
        List<Point> points, List<HistoryPoint> history, Totals totals, List<ChannelSummary> channels,
        List<String> warnings) {

    /** Прогноз на неделю: значение, интервал, разложение по каналам и плановые затраты. */
    public record Point(LocalDate weekStart, double predicted, double lower, double upper, Double base,
                        Map<String, Double> contributions, Map<String, Double> spend) {
    }

    public record HistoryPoint(LocalDate weekStart, double actual) {
    }

    public record Totals(double predicted, double lower, double upper, Double base, double totalSpend,
                         Double previousPeriodActual, Double changeVsPreviousPct,
                         Double sameWeeksLastYearActual, Double changeVsLastYearPct) {
    }

    public record ChannelSummary(String code, String name, double plannedSpend, Double contribution,
                                 Double contributionShare, Double roi, Double marginalRoi,
                                 Double saturationLevel, boolean lowVariation) {
    }
}
