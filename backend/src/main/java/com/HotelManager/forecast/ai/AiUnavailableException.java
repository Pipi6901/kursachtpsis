package com.HotelManager.forecast.ai;

/**
 * Интеллектуальный сервис недоступен: нет соединения, истёк тайм-аут или он ответил ошибкой 5xx.
 * Именно такие сбои учитывает предохранитель (circuit breaker) и повторные попытки.
 */
public class AiUnavailableException extends RuntimeException {

    public AiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
