package com.HotelManager.forecast.repo;

import com.HotelManager.forecast.entity.MarketingCampaign;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MarketingCampaignRepository
        extends JpaRepository<MarketingCampaign, Long>, JpaSpecificationExecutor<MarketingCampaign> {

    /** Кампании, пересекающиеся с периодом [from, to]; канал загружается сразу. */
    @Query("select c from MarketingCampaign c join fetch c.channel "
            + "where c.endDate >= :from and c.startDate <= :to order by c.startDate, c.id")
    List<MarketingCampaign> findOverlapping(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @EntityGraph(attributePaths = "channel")
    Optional<MarketingCampaign> findWithChannelById(Long id);

    long countByChannelId(Long channelId);
}
