package com.HotelManager.DTO;

import com.HotelManager.entity.Comment;
import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import lombok.Data;

import java.util.List;

@Data
public class RoomDTO {

    private Long id;
    private String name;
    private int price;
    private String photo;
    private boolean free;
    private int days;
    private Type type;
    private Beds beds;
    private int number;
    private String description;
    private int floor;
    private List<Comment> comments;
}
