package com.HotelManager.DTO;


import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.entity.enums.Type;
import lombok.Data;

@Data
public class ReservationResponseDTO {

    private Long id;
    private String name;
    private String owner;
    private int price;
    private String status;
    private int days;
    private Type type;
    private Beds beds;
    private int number;
    private String description;
    private int floor;

    private Long roomId;

    private int roomPrice;
    private String photo;
    private String receiptStatus;
}