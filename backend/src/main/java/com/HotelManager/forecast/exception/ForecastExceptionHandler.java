package com.HotelManager.forecast.exception;

import com.HotelManager.exception.AppError;
import com.HotelManager.forecast.ai.AiRequestException;
import com.HotelManager.forecast.ai.AiUnavailableException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

/**
 * Единый формат ошибок модуля прогнозирования: {status, message, timestamp} (как в остальном API).
 * Намеренно нет обработчика для Exception: ошибки доступа обрабатывает Spring Security.
 */
@Slf4j
@RestControllerAdvice(basePackages = "com.HotelManager.forecast")
public class ForecastExceptionHandler {

    @ExceptionHandler(ForecastException.class)
    public ResponseEntity<AppError> handleForecast(ForecastException e) {
        return respond(e.getStatus(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AppError> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return respond(HttpStatus.BAD_REQUEST, message.isEmpty() ? "Некорректные данные запроса" : message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<AppError> handleConstraint(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return respond(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<AppError> handleUnreadable(Exception e) {
        return respond(HttpStatus.BAD_REQUEST, "Некорректный формат данных запроса");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<AppError> handleIntegrity(DataIntegrityViolationException e) {
        log.warn("Нарушение целостности данных: {}", e.getMostSpecificCause().getMessage());
        return respond(HttpStatus.CONFLICT, "Операция нарушает ограничения целостности данных");
    }

    /** Интеллектуальный сервис отклонил запрос (ошибка данных) или ключ доступа. */
    @ExceptionHandler(AiRequestException.class)
    public ResponseEntity<AppError> handleAiRequest(AiRequestException e) {
        int s = e.getStatus();
        if (s == 401 || s == 403) {
            log.error("ML-сервис отклонил ключ доступа (HTTP {}): проверьте forecast.ai.api-key и ML_API_KEY", s);
            return respond(HttpStatus.BAD_GATEWAY,
                    "Интеллектуальный сервис отклонил ключ доступа. Проверьте настройки ключа на обоих узлах.");
        }
        if (s == 404) {
            return respond(HttpStatus.NOT_FOUND, "Модель не найдена в реестре интеллектуального сервиса. "
                    + "Обучите модель заново.");
        }
        if (s == 409 || s == 429) {
            return respond(HttpStatus.CONFLICT, e.getMessage());
        }
        return respond(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
    }

    @ExceptionHandler({AiUnavailableException.class, CallNotPermittedException.class})
    public ResponseEntity<AppError> handleAiUnavailable(Exception e) {
        log.warn("Интеллектуальный сервис недоступен: {}", e.getMessage());
        return respond(HttpStatus.SERVICE_UNAVAILABLE,
                "Интеллектуальный сервис временно недоступен. Повторите попытку позже.");
    }

    private ResponseEntity<AppError> respond(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(new AppError(status.value(), message));
    }
}
