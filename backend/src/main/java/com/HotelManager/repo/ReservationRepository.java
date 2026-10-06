package com.HotelManager.repo;

import com.HotelManager.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.HotelManager.entity.enums.ReservationStatus;

import java.util.Collection;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByOwner(String name);

    List<Reservation> findByRoomIdAndStatusIn(Long roomId, Collection<ReservationStatus> statuses);

    List<Reservation> findByStatusIn(Collection<ReservationStatus> statuses);
}
