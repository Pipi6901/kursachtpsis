package com.HotelManager.entity;

import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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

    /** Площадь номера, м² (необязательна: у ранее созданных номеров не задана). */
    @Column(name = "area")
    private Integer area;

    /** Вид из окна (необязательно). Столбец назван view_type: VIEW – зарезервированное слово SQL. */
    @Column(name = "view_type", length = 60)
    private String view;

    /** Удобства номера: коды из каталога клиента (WIFI, AC, TV …); отдельная таблица room_amenity. */
    @Builder.Default
    @JsonIgnore
    @ElementCollection
    @CollectionTable(name = "room_amenity", joinColumns = @JoinColumn(name = "room_id"))
    @Column(name = "amenity", length = 40)
    @BatchSize(size = 50)
    private Set<String> amenities = new LinkedHashSet<>();

    /** Фотографии номера по порядку; первая – обложка. */
    @Builder.Default
    @JsonIgnore
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, id ASC")
    @BatchSize(size = 50)
    private List<RoomImage> images = new ArrayList<>();

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