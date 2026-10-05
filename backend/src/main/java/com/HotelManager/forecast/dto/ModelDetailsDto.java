package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.util.List;

/** Полное описание модели: качество, таблица лидеров, параметры каналов, проверка вне выборки. */
public record ModelDetailsDto(
        ModelSummaryDto summary, int cvFolds, int cvHorizon, double intervalLevel, Double smape, Double bias,
        List<Candidate> candidates, List<ChannelEffect> channelEffects, List<BacktestPoint> backtest,
        List<String> warnings) {

    public record Candidate(String algorithm, String label, boolean scenarioAware, boolean selected,
                            Double wape, Double mape, Double rmse, Double skillVsNaive, String skippedReason) {
    }

    public record ChannelEffect(String channelCode, String channelName, double adstockDecay,
                                double saturationScale, double maxEffect, double totalSpend,
                                double meanWeeklySpend, int activeWeeks, double spendCv,
                                double contributionTotal, double contributionShare, Double roi,
                                Double marginalRoi, double saturationLevel, boolean lowVariation) {
    }

    public record BacktestPoint(LocalDate weekStart, double actual, double predicted, double lower, double upper) {
    }
}
