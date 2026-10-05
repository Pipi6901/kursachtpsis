package com.HotelManager.forecast.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

/**
 * Описание сценария. {@code multipliers} — множители к запланированным затратам канала (1 = как в плане);
 * {@code weeklySpend} — постоянные недельные затраты канала (заменяют план для этого канала).
 */
public record ScenarioRequest(@NotNull(message = "укажите тип сценария") ScenarioType type,
                              Map<String, Double> multipliers,
                              Map<String, Double> weeklySpend) {

    public static ScenarioRequest plan() {
        return new ScenarioRequest(ScenarioType.PLAN, Map.of(), Map.of());
    }
}
