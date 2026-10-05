package com.HotelManager.forecast.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/** Конфигурация модуля прогнозирования: свойства, планировщик задач. */
@Configuration
@EnableScheduling
@EnableConfigurationProperties(ForecastProperties.class)
public class ForecastConfig {

    /** Отдельный планировщик для фоновых задач модуля (первичное обучение, плановое переобучение). */
    @Bean(name = "forecastTaskScheduler")
    public ThreadPoolTaskScheduler forecastTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("forecast-");
        scheduler.setDaemon(true);
        return scheduler;
    }
}
