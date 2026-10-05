package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.config.ForecastProperties;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Кэш ответов интеллектуального сервиса (Caffeine). Ключ включает идентификатор модели, начало и горизонт
 * прогноза и отпечаток матрицы затрат, поэтому любое изменение плана или модели даёт другой ключ:
 * устаревший ответ не может быть возвращён. Ошибки в кэш не попадают.
 */
@Component
public class AiForecastCache {

    private final Cache<String, AiContract.ForecastResponse> cache;

    public AiForecastCache(ForecastProperties properties) {
        this.cache = Caffeine.newBuilder()
                .maximumSize(properties.cache().maxSize())
                .expireAfterWrite(properties.cache().ttl())
                .recordStats()
                .build();
    }

    public AiContract.ForecastResponse get(String key, Supplier<AiContract.ForecastResponse> loader) {
        return cache.get(key, k -> loader.get());
    }

    public CacheStats stats() {
        return cache.stats();
    }

    public long size() {
        return cache.estimatedSize();
    }

    public void clear() {
        cache.invalidateAll();
    }
}
