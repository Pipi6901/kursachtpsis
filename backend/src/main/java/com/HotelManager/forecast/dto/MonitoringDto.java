package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.util.List;

/** Контроль качества после обучения: прогноз модели против фактических продаж новых недель. */
public record MonitoringDto(Long modelId, String status, String statusTitle, int weeks, Double wape,
                            Double baselineWape, Double ratio, String recommendation, List<Point> points) {

    public record Point(LocalDate weekStart, double actual, double predicted) {
    }
}
