package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.ai.AiRequestException;
import com.HotelManager.forecast.ai.AiUnavailableException;
import com.HotelManager.forecast.ai.ForecastAiGateway;
import com.HotelManager.forecast.config.ForecastProperties;
import com.HotelManager.forecast.dto.StatusDto;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.repo.MarketingCampaignRepository;
import com.HotelManager.forecast.repo.MarketingChannelRepository;
import com.HotelManager.forecast.repo.SalesWeeklyRepository;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Сводка о состоянии модуля для индикатора в интерфейсе. */
@Service
@RequiredArgsConstructor
public class StatusService {

    private final ForecastAiGateway gateway;
    private final CircuitBreakerRegistry circuitBreakers;
    private final AiForecastCache cache;
    private final ForecastModelService models;
    private final SalesWeeklyRepository sales;
    private final MarketingChannelRepository channels;
    private final MarketingCampaignRepository campaigns;
    private final ForecastProperties properties;

    @Transactional(readOnly = true)
    public StatusDto status() {
        String breaker = circuitBreakers.circuitBreaker("mlService").getState().name();
        String state;
        String title;
        String version = null;
        Boolean encryption = null;
        try {
            AiContract.Health health = gateway.health();
            state = "UP";
            title = "Интеллектуальный сервис доступен";
            version = health.version();
            encryption = health.encryptionEnabled();
        } catch (CallNotPermittedException e) {
            state = "CIRCUIT_OPEN";
            title = "Сервис недоступен: предохранитель разомкнут, используется упрощённый расчёт";
        } catch (AiUnavailableException e) {
            state = "DOWN";
            title = "Интеллектуальный сервис недоступен: используется упрощённый расчёт";
        } catch (AiRequestException e) {
            state = "DOWN";
            title = "Интеллектуальный сервис отклонил запрос (HTTP " + e.getStatus() + ")";
        }
        CacheStats stats = cache.stats();

        List<StatusDto.ActiveModel> active = new ArrayList<>();
        var summaries = models.list();
        for (ForecastTarget target : ForecastTarget.values()) {
            summaries.stream().filter(m -> m.target().equals(target.name()) && "ACTIVE".equals(m.status()))
                    .findFirst().ifPresentOrElse(
                            m -> active.add(new StatusDto.ActiveModel(target.name(), target.getTitle(), m.id(),
                                    m.algorithmLabel(), m.stale())),
                            () -> active.add(new StatusDto.ActiveModel(target.name(), target.getTitle(), null, null, false)));
        }
        var all = sales.findAllByOrderByWeekStartAsc();
        StatusDto.DataInfo info = new StatusDto.DataInfo(all.size(),
                all.isEmpty() ? null : all.get(0).getWeekStart(),
                all.isEmpty() ? null : all.get(all.size() - 1).getWeekStart(),
                (int) channels.count(), campaigns.count());
        return new StatusDto(new StatusDto.Ai(state, title, version, encryption, breaker,
                properties.ai().baseUrl()), new StatusDto.Cache(stats.hitCount(), stats.missCount(), cache.size()),
                active, info);
    }
}
