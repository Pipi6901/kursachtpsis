package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RoomStatsDTO {
    private String roomName;
    private int income;
}