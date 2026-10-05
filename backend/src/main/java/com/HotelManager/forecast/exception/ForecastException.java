package com.HotelManager.forecast.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Ожидаемая ошибка модуля: сообщение на русском показывается пользователю как есть. */
@Getter
public class ForecastException extends RuntimeException {

    private final HttpStatus status;

    public ForecastException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ForecastException badRequest(String message) {
        return new ForecastException(HttpStatus.BAD_REQUEST, message);
    }

    public static ForecastException notFound(String message) {
        return new ForecastException(HttpStatus.NOT_FOUND, message);
    }

    public static ForecastException conflict(String message) {
        return new ForecastException(HttpStatus.CONFLICT, message);
    }

    public static ForecastException unavailable(String message) {
        return new ForecastException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }
}
