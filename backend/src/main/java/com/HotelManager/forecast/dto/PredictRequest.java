package com.HotelManager.forecast.dto;

import com.HotelManager.forecast.entity.ForecastTarget;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PredictRequest(
        @NotNull(message = "выберите показатель")
        ForecastTarget target,
        @Min(value = 1, message = "горизонт — не менее 1 недели")
        @Max(value = 52, message = "горизонт — не более 52 недель")
        int horizonWeeks,
        @Valid
        ScenarioRequest scenario) {

    public ScenarioRequest scenarioOrPlan() {
        return scenario == null ? ScenarioRequest.plan() : scenario;
    }
}
