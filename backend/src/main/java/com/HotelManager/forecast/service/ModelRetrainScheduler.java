package com.HotelManager.forecast.service;

import com.HotelManager.forecast.config.ForecastProperties;
import com.HotelManager.forecast.entity.ForecastTarget;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Плановое переобучение (MLOps-цикл): по расписанию проверяет, изменились ли данные с момента обучения
 * активной модели (или пропала ли она из реестра интеллектуального сервиса), и при необходимости обучает новую версию. Расписание — forecast.retrain.cron.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ModelRetrainScheduler {

    private final ForecastModelService modelService;
    private final ForecastProperties properties;

    @Scheduled(cron = "${forecast.retrain.cron:0 0 3 * * MON}")
    public void retrain() {
        if (!properties.retrain().enabled()) {
            return;
        }
        for (ForecastTarget target : ForecastTarget.values()) {
            try {
                if (modelService.needsTraining(target) || modelService.registryLost(target)) {
                    log.info("Плановое переобучение модели «{}»", target.getTitle());
                    modelService.train(target, "system");
                }
            } catch (RuntimeException e) {
                log.warn("Плановое переобучение «{}» не выполнено: {}", target.getTitle(), e.getMessage());
            }
        }
    }
}
