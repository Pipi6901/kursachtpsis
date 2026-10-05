package com.HotelManager.forecast.dto;

import com.HotelManager.forecast.entity.ChannelType;

public record ChannelDto(Long id, String code, String name, ChannelType type, String typeTitle,
                         String description, boolean active, int sortOrder, long campaignCount) {
}
