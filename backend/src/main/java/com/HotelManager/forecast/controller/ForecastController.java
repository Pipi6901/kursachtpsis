package com.HotelManager.forecast.controller;

import com.HotelManager.forecast.dto.OptimizationDto;
import com.HotelManager.forecast.dto.OptimizeRequestDto;
import com.HotelManager.forecast.dto.PredictRequest;
import com.HotelManager.forecast.dto.PredictionDto;
import com.HotelManager.forecast.dto.StatusDto;
import com.HotelManager.forecast.service.ForecastService;
import com.HotelManager.forecast.service.OptimizationService;
import com.HotelManager.forecast.service.StatusService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Прогноз продаж, оптимизация бюджета и состояние модуля. Доступно администратору и менеджеру. */
@RestController
@RequestMapping("/api/forecast")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
@Tag(name = "Прогноз продаж", description = "Прогнозирование объёмов продаж с учётом мультиканальных маркетинговых активностей")
public class ForecastController {

    private final ForecastService forecastService;
    private final OptimizationService optimizationService;
    private final StatusService statusService;

    @Operation(summary = "Прогноз продаж на период по сценарию маркетинговых затрат",
            description = "Возвращает прогноз с доверительным интервалом, разложением по каналам, историей и "
                    + "сравнением с прошлыми периодами. При недоступности интеллектуального сервиса выдаёт "
                    + "упрощённый прогноз с признаком degraded=true.")
    @PostMapping("/predict")
    public PredictionDto predict(@Valid @RequestBody PredictRequest request) {
        return forecastService.predict(request);
    }

    @Operation(summary = "Оптимальное распределение бюджета между каналами")
    @PostMapping("/optimize")
    public OptimizationDto optimize(@Valid @RequestBody OptimizeRequestDto request) {
        return optimizationService.optimize(request);
    }

    @Operation(summary = "Состояние модуля: интеллектуальный сервис, предохранитель, кэш, модели, данные")
    @GetMapping("/status")
    public StatusDto status() {
        return statusService.status();
    }
}
