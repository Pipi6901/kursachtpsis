package com.HotelManager.forecast.seed;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonNaming;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Формат файла демонстрационных данных (resources/demo/forecast-demo-data.json). */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DemoDataFile(List<Channel> channels, List<Campaign> campaigns, List<Sales> sales) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Channel(String code, String name, String type, String description) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Campaign(String channel, String name, LocalDate startDate, LocalDate endDate, BigDecimal budget) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Sales(LocalDate weekStart, int bookings, BigDecimal revenue) {
    }
}
