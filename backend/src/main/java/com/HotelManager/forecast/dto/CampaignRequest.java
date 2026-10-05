package com.HotelManager.forecast.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CampaignRequest(
        @NotNull(message = "выберите канал")
        Long channelId,
        @NotBlank(message = "укажите название")
        @Size(max = 150, message = "не более 150 символов")
        String name,
        @NotNull(message = "укажите дату начала")
        LocalDate startDate,
        @NotNull(message = "укажите дату окончания")
        LocalDate endDate,
        @NotNull(message = "укажите бюджет")
        @DecimalMin(value = "0.00", message = "бюджет не может быть отрицательным")
        @DecimalMax(value = "9999999999.99", message = "слишком большой бюджет")
        BigDecimal budget,
        @Size(max = 500, message = "не более 500 символов")
        String note) {
}
