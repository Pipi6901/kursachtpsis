package com.HotelManager.repo;

import com.HotelManager.entity.Room;
import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    @Query("SELECT a FROM Room a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))")
    List<Room> findByNameContaining(@Param("name")String name);

    List<Room> findAllByOrderByFreeDesc();

    /** Номер с блокировкой строки: бронирования одного номера оформляются по очереди. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.id = :id")
    Optional<Room> findByIdForUpdate(@Param("id") Long id);

}
