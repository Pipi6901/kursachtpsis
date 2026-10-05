package com.HotelManager.forecast.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CampaignDto(Long id, Long channelId, String channelCode, String channelName, String name,
                          LocalDate startDate, LocalDate endDate, BigDecimal budget, BigDecimal weeklyBudget,
                          int days, String status, String note, String createdBy) {
}
