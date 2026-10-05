package com.HotelManager.forecast.dto;

import java.util.List;

public record SalesImportResult(int created, int updated, int normalizedDates, List<String> warnings) {
}
