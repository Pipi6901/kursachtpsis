package com.HotelManager.DTO;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReceiptDTO {
    private Long id;
    private String userName;
    private String roomName;
    private int days;
    private double totalAmount;
    private LocalDateTime createdAt;
    private String status;
}