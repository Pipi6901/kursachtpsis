package com.HotelManager.forecast.dto;

import com.HotelManager.forecast.entity.DataSource;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SalesWeekDto(LocalDate weekStart, int bookings, BigDecimal revenue, DataSource source) {
}
