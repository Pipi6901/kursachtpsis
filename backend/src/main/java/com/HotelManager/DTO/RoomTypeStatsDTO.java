package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RoomTypeStatsDTO {
    private String type;           // Тип номера (STANDARD, ECONOMY, VIP)
    private int bookingsCount;     // Количество бронирований
    private double totalRevenue;   // Общая выручка по этому типу
    private double occupancyRate;  // Загруженность (%)
}