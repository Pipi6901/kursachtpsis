package com.HotelManager.forecast.dto;

import java.time.LocalDate;
import java.util.List;

/** Состояние модуля: интеллектуальный сервис, предохранитель, кэш, модели и данные. */
public record StatusDto(Ai ai, Cache cache, List<ActiveModel> models, DataInfo data) {

    /** state: UP — сервис доступен; DOWN — недоступен; CIRCUIT_OPEN — предохранитель разомкнут. */
    public record Ai(String state, String stateTitle, String version, Boolean encryptionEnabled,
                     String circuitBreaker, String baseUrl) {
    }

    public record Cache(long hits, long misses, long size) {
    }

    public record ActiveModel(String target, String targetTitle, Long modelId, String algorithmLabel,
                              boolean stale) {
    }

    public record DataInfo(int salesWeeks, LocalDate firstWeek, LocalDate lastWeek, int channels, long campaigns) {
    }
}
