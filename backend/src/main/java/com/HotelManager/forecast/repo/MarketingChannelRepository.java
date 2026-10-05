package com.HotelManager.forecast.repo;

import com.HotelManager.forecast.entity.MarketingChannel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MarketingChannelRepository extends JpaRepository<MarketingChannel, Long> {

    Optional<MarketingChannel> findByCode(String code);

    boolean existsByCode(String code);

    List<MarketingChannel> findAllByOrderBySortOrderAscIdAsc();

    List<MarketingChannel> findAllByActiveTrueOrderBySortOrderAscIdAsc();
}
