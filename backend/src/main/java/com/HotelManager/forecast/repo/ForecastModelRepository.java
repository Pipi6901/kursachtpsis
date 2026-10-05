package com.HotelManager.forecast.repo;

import com.HotelManager.forecast.entity.ForecastModel;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.entity.ModelStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ForecastModelRepository extends JpaRepository<ForecastModel, Long> {

    List<ForecastModel> findAllByOrderByTrainedAtDesc();

    List<ForecastModel> findByTargetOrderByTrainedAtDesc(ForecastTarget target);

    Optional<ForecastModel> findFirstByTargetAndStatusOrderByTrainedAtDesc(ForecastTarget target, ModelStatus status);

    List<ForecastModel> findByTargetAndStatus(ForecastTarget target, ModelStatus status);

    Optional<ForecastModel> findByExternalId(String externalId);
}
