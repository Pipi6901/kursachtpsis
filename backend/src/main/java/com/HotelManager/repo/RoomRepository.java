package com.HotelManager.repo;

import com.HotelManager.entity.Room;
import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    @Query("SELECT a FROM Room a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))")
    List<Room> findByNameContaining(@Param("name")String name);

    List<Room> findAllByOrderByFreeDesc();

}
