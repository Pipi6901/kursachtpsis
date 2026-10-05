package com.HotelManager.forecast.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SalesWeekRequest(
        @NotNull(message = "укажите дату недели")
        LocalDate weekStart,
        @Min(value = 0, message = "число бронирований не может быть отрицательным")
        @Max(value = 1_000_000, message = "слишком большое число бронирований")
        int bookings,
        @NotNull(message = "укажите выручку")
        @DecimalMin(value = "0.00", message = "выручка не может быть отрицательной")
        @DecimalMax(value = "99999999999.99", message = "слишком большая выручка")
        BigDecimal revenue) {
}
