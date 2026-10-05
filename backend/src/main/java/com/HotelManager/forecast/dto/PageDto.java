package com.HotelManager.forecast.dto;

import java.util.List;

public record PageDto<T>(List<T> content, long totalElements, int page, int size, int totalPages) {
}
