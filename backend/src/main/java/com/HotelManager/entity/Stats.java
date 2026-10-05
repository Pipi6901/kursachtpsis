package com.HotelManager.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@NoArgsConstructor
@Table(name = "stats")
public class Stats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(nullable = false)
    private int days;

    @Column(nullable = false)
    private int price; // Цена за день бронирования

    public Stats(Room room, int days, int price) {
        this.room = room;
        this.days = days;
        this.price = price;
    }
}