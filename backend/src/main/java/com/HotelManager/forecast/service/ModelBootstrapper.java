package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiRequestException;
import com.HotelManager.forecast.config.ForecastProperties;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.exception.ForecastException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ScheduledFuture;

/**
 * Первичное обучение моделей после запуска. Интеллектуальный сервис может стартовать позже серверной
 * части (отдельный узел), поэтому попытки повторяются, пока обучение не завершится, не станет ясно, что
 * оно невозможно (нет данных), или не исчерпается лимит попыток.
 */
@Slf4j
@Component
public class ModelBootstrapper {

    static final int MAX_ATTEMPTS = 20;
    static final Duration DELAY = Duration.ofSeconds(30);

    private final ForecastModelService modelService;
    private final ForecastProperties properties;
    private final TaskScheduler scheduler;
    private volatile ScheduledFuture<?> future;
    private int attempts;

    public ModelBootstrapper(ForecastModelService modelService, ForecastProperties properties,
                             @Qualifier("forecastTaskScheduler") TaskScheduler scheduler) {
        this.modelService = modelService;
        this.properties = properties;
        this.scheduler = scheduler;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        if (properties.bootstrap().trainOnStartup()) {
            future = scheduler.scheduleWithFixedDelay(this::attempt, Instant.now().plusSeconds(5), DELAY);
        }
    }

    /** Одна попытка: обучает показатели, у которых ещё нет активной модели. Возвращает true, когда повторы не нужны. */
    boolean attempt() {
        attempts++;
        boolean finished = true;
        for (ForecastTarget target : ForecastTarget.values()) {
            if (modelService.activeModel(target).isPresent()) {
                continue;
            }
            try {
                modelService.train(target, "system");
            } catch (ForecastException e) {
                if (e.getStatus() == HttpStatus.BAD_REQUEST) {
                    log.info("Первичное обучение «{}» невозможно: {}", target.getTitle(), e.getMessage());
                } else {
                    finished = false;
                }
            } catch (AiRequestException e) {
                log.warn("Первичное обучение «{}» отклонено интеллектуальным сервисом: {}", target.getTitle(),
                        e.getMessage());
            } catch (RuntimeException e) {
                log.info("Интеллектуальный сервис пока недоступен, повторная попытка позже ({}): {}", attempts,
                        e.getMessage());
                finished = false;
            }
        }
        if (finished || attempts >= MAX_ATTEMPTS) {
            ScheduledFuture<?> f = future;
            if (f != null) {
                f.cancel(false);
            }
            return true;
        }
        return false;
    }
}
