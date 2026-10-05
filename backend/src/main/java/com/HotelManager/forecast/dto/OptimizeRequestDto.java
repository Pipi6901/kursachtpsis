package com.HotelManager.forecast.dto;

import com.HotelManager.forecast.entity.ForecastTarget;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record OptimizeRequestDto(
        @NotNull(message = "выберите показатель")
        ForecastTarget target,
        @Min(value = 1, message = "горизонт — не менее 1 недели")
        @Max(value = 52, message = "горизонт — не более 52 недель")
        int horizonWeeks,
        /** Бюджет на весь горизонт; если не задан — суммарный бюджет плана. */
        @DecimalMin(value = "1.0", message = "бюджет должен быть положительным")
        @DecimalMax(value = "1000000000", message = "слишком большой бюджет")
        Double totalBudget,
        @Valid
        List<ChannelLimit> limits) {

    public record ChannelLimit(
            @NotBlank(message = "укажите канал")
            String channelCode,
            @DecimalMin(value = "0", message = "доля от 0 до 1") @DecimalMax(value = "1", message = "доля от 0 до 1")
            double minShare,
            @DecimalMin(value = "0", message = "доля от 0 до 1") @DecimalMax(value = "1", message = "доля от 0 до 1")
            double maxShare) {
    }
}
