package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Краткие сведения об используемой модели (для подписи под прогнозом). */
public record ModelInfoDto(Long id, String externalId, String algorithm, String algorithmLabel,
                           LocalDateTime trainedAt, LocalDate dataTo, Double wape, Double mape, boolean stale) {
}
