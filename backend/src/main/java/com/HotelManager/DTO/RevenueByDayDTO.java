package com.HotelManager.DTO;


import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RevenueByDayDTO {
    private String day;
    private double revenue;
    private int bookingsCount;
}