package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ModelSummaryDto(Long id, String externalId, String target, String targetTitle, String status,
                              String algorithm, String algorithmLabel, LocalDateTime trainedAt, String trainedBy,
                              LocalDate dataFrom, LocalDate dataTo, int observations, Double wape, Double mape,
                              Double rmse, boolean stale) {
}
