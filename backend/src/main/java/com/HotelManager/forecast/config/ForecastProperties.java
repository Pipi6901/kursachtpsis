package com.HotelManager.forecast.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/** Настройки модуля прогнозирования (префикс forecast.*). */
@ConfigurationProperties(prefix = "forecast")
public record ForecastProperties(
        @DefaultValue Ai ai,
        @DefaultValue DemoData demoData,
        @DefaultValue Bootstrap bootstrap,
        @DefaultValue Retrain retrain,
        @DefaultValue Cache cache) {

    /** Параметры интеграции с интеллектуальным микросервисом. */
    public record Ai(
            @DefaultValue("http://localhost:8001") String baseUrl,
            @DefaultValue("dev-ml-key-change-me") String apiKey,
            @DefaultValue("PT2S") Duration connectTimeout,
            @DefaultValue("PT8S") Duration inferenceTimeout,
            @DefaultValue("PT5M") Duration trainingTimeout,
            @DefaultValue("") String trustStore,
            @DefaultValue("changeit") String trustStorePassword) {
    }

    public record DemoData(@DefaultValue("true") boolean enabled) {
    }

    public record Bootstrap(@DefaultValue("true") boolean trainOnStartup) {
    }

    public record Retrain(@DefaultValue("true") boolean enabled,
                          @DefaultValue("0 0 3 * * MON") String cron) {
    }

    public record Cache(@DefaultValue("PT10M") Duration ttl, @DefaultValue("200") int maxSize) {
    }
}
