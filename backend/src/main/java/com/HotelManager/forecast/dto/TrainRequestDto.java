package com.HotelManager.forecast.dto;

import com.HotelManager.forecast.entity.ForecastTarget;
import jakarta.validation.constraints.NotNull;

public record TrainRequestDto(@NotNull(message = "выберите показатель") ForecastTarget target) {
}
