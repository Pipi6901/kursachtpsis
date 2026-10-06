package com.HotelManager.forecast.repo;

import com.HotelManager.forecast.entity.ForecastAlgorithm;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ForecastAlgorithmRepository extends JpaRepository<ForecastAlgorithm, String> {
}
