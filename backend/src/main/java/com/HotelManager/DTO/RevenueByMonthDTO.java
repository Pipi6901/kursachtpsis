package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RevenueByMonthDTO {
    private String month;
    private double revenue;
    private int bookingsCount;
}