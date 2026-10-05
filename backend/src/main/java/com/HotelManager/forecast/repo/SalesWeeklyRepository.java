package com.HotelManager.forecast.repo;

import com.HotelManager.forecast.entity.SalesWeekly;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SalesWeeklyRepository extends JpaRepository<SalesWeekly, Long> {

    List<SalesWeekly> findAllByOrderByWeekStartAsc();

    List<SalesWeekly> findByWeekStartBetweenOrderByWeekStartAsc(LocalDate from, LocalDate to);

    Optional<SalesWeekly> findByWeekStart(LocalDate weekStart);

    Optional<SalesWeekly> findTopByOrderByWeekStartDesc();
}
