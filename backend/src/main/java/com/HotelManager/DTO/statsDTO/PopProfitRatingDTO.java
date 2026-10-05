package com.HotelManager.DTO.statsDTO;

import com.HotelManager.DTO.RoomStatsDTO;
import lombok.Data;

import java.util.List;

@Data
public class PopProfitRatingDTO {
    private int totalIncome;
    private List<RoomStatsDTO> topRoomsByIncome;
    private List<RoomStatsDTO> topRoomsByBookings;
}