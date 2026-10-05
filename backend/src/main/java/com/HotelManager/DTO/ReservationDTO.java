package com.HotelManager.DTO;

import com.HotelManager.entity.Comment;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.enums.Type;
import com.HotelManager.entity.enums.Beds;
import lombok.Data;

import java.util.List;

@Data
public class ReservationDTO {

    private Long id;
    private String name;
    private String owner;
    private String photo;
    private int price;
    private int days;
    private Type type;
    private Beds beds;
    private int number;
    private String description;
    private int floor;
    private List<Comment> comments;
    private RoomDTO room;
}
