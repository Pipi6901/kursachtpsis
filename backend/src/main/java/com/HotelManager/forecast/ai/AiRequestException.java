package com.HotelManager.forecast.ai;

import lombok.Getter;

/**
 * Интеллектуальный сервис ответил ошибкой 4xx (например, данные не прошли проверку).
 * Это не сбой доступности, поэтому на состояние предохранителя не влияет.
 */
@Getter
public class AiRequestException extends RuntimeException {

    private final int status;

    public AiRequestException(int status, String message) {
        super(message);
        this.status = status;
    }
}
