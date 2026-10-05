package com.HotelManager.entity;

import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference; // <-- ДОБАВЛЕНО
import com.HotelManager.entity.enums.ReservationStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class Reservation {

    @Setter(AccessLevel.NONE)
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false, updatable = false)
    private Long id;

    private String name;

    private int price;
    private String photo;
    private boolean free;
    private int days;

    @Enumerated(EnumType.STRING)
    private Type type;

    @Enumerated(EnumType.STRING)
    private Beds beds;

    private int number;
    private String description;
    private int floor;

    @Enumerated(EnumType.STRING)
    private ReservationStatus status;

    @ManyToOne
    @JsonBackReference("room-reservations") //
    private Room room;

    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("reservation-receipts") //
    private List<Receipt> receipts;

    private String owner;
}