package com.HotelManager.entity;

import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import java.util.List;

@Data
@Table(name = "room")
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_id", nullable = false, updatable = false)
    private Long id;

    private String name;
    private int price;
    private String photo;
    private boolean free;
    private int days = 0;

    @Enumerated(EnumType.STRING)
    private Type type;

    @Enumerated(EnumType.STRING)
    private Beds beds;

    private int number;
    private String description;
    private int floor;

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("room-comments") // <-- ИСПРАВЛЕНИЕ: Имя для Comments
    private List<Comment> comments;

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("room-reservations") // <-- ИСПРАВЛЕНИЕ: Имя для Reservations
    private List<Reservation> reservations;

    @Override
    public String toString(){
        return "Room{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", price=" + price +
                ", free='" + free + '\'' +
                ", days=" + days +
                ", type=" + type + '\'' +
                ", beds=" + beds +
                ", number=" + number + '\'' +
                ", description=" + description +
                ", floor=" + floor + '\'' +
                '}';
    }
}