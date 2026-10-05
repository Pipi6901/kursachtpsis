package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AnalyticsMetricsDTO {
    private double totalRevenue;
    private int totalBookings;
    private int confirmedBookings;         // Подтвержденные брони
    private int waitingBookings;           // Ожидающие подтверждения
    private int rejectedBookings;          // Отклоненные брони
    private int totalRooms;                // Всего номеров
    private int occupiedRooms;             // Занятые номера
    private double occupancyRate;          // Процент загруженности (%)
    private int totalUsers;                // Всего пользователей
}