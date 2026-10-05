package com.HotelManager.forecast.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Прогнозируемый показатель продаж. */
@Getter
@AllArgsConstructor
public enum ForecastTarget {
    REVENUE("revenue", "Выручка"),
    BOOKINGS("bookings", "Бронирования");

    /** Метка показателя в контракте с ML-сервисом. */
    private final String mlLabel;
    private final String title;
}
