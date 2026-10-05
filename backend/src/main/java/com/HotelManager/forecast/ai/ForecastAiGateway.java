package com.HotelManager.forecast.ai;

/**
 * Шлюз к интеллектуальному микросервису (паттерн «AI Gateway / Adapter»).
 * Серверная часть зависит только от этого интерфейса: транспорт, аутентификация, тайм-ауты и
 * устойчивость спрятаны в реализации, а при недоступности сервиса вызывающий код переходит
 * на упрощённый расчёт (fallback).
 */
public interface ForecastAiGateway {

    /** Обучение (долгая операция, без предохранителя): исключения пробрасываются вызывающему. */
    AiContract.TrainResponse train(AiContract.TrainRequest request);

    AiContract.ForecastResponse forecast(String modelId, AiContract.ForecastRequest request);

    AiContract.OptimizeResponse optimize(String modelId, AiContract.OptimizeRequest request);

    AiContract.Health health();
}
