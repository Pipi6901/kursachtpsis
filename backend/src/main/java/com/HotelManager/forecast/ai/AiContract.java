package com.HotelManager.forecast.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonNaming;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Контракт с интеллектуальным микросервисом (REST/JSON, snake_case). Серверная часть не использует
 * эти типы за пределами пакета ai: бизнес-логика работает со своими DTO, а шлюз переводит одно в другое
 * (паттерн «защитный слой» — Anti-Corruption Layer).
 */
public final class AiContract {

    private AiContract() {
    }

    // ----------------------------------------------------------------------- запросы

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Channel(String code, String name) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record SalesPoint(LocalDate weekStart, double value) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record SpendRow(LocalDate weekStart, Map<String, Double> spend) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TrainOptions(Integer cvFolds, Integer cvHorizon, Double intervalLevel, Integer seed) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TrainRequest(String target, List<Channel> channels, List<SalesPoint> sales,
                               List<SpendRow> spend, TrainOptions options, String fingerprint) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ForecastRequest(LocalDate startWeek, int horizonWeeks, List<SpendRow> spend,
                                  Double intervalLevel, boolean includeComponents) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Constraint(String code, double minShare, double maxShare) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record OptimizeRequest(LocalDate startWeek, int horizonWeeks, double totalBudget,
                                  List<SpendRow> spend, List<Constraint> constraints) {
    }

    // ----------------------------------------------------------------------- ответы

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Metrics(Double wape, Double mape, Double smape, Double rmse, Double bias, int n) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Candidate(String name, String label, boolean scenarioAware, boolean selected,
                            Metrics metrics, Double skillVsNaive, String skippedReason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ChannelEffect(String code, double adstockDecay, double saturationScale, double maxEffect,
                                double totalSpend, double meanWeeklySpend, int activeWeeks, double spendCv,
                                double contributionTotal, double contributionShare, Double roi,
                                Double marginalRoi, double saturationLevel, boolean lowVariation) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record BacktestPoint(LocalDate weekStart, double actual, double predicted, double lower, double upper) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TrainResponse(String modelId, String target, OffsetDateTime createdAt, String champion,
                                String championLabel, LocalDate dataFrom, LocalDate dataTo, int nObs,
                                String fingerprint, double intervalLevel, int cvFolds, int cvHorizon,
                                Metrics metrics, List<Candidate> leaderboard,
                                List<ChannelEffect> channelEffects, List<BacktestPoint> backtest,
                                List<String> warnings) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ForecastPoint(LocalDate weekStart, double predicted, double lower, double upper,
                                Double base, Map<String, Double> contributions) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ForecastTotals(double predicted, double lower, double upper, Double base,
                                 Map<String, Double> contributions) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ForecastResponse(String modelId, String champion, double intervalLevel,
                                   boolean componentsAvailable, List<ForecastPoint> points,
                                   ForecastTotals totals) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Allocation(String code, double weeklySpend, double totalSpend, double share,
                             double expectedEffect, double marginalReturn, double planTotalSpend,
                             double planEffect) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record OptimizeResponse(String modelId, double totalBudget, double spentBudget, double planBudget,
                                   double planMarketingEffect, double optimizedMarketingEffect,
                                   double upliftAbs, Double upliftPct, List<Allocation> allocations,
                                   List<String> notes) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Health(String status, String version, int modelsTotal, boolean encryptionEnabled) {
    }
}
