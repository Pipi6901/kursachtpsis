package com.HotelManager.forecast.controller;

import com.HotelManager.forecast.dto.ModelDetailsDto;
import com.HotelManager.forecast.dto.ModelSummaryDto;
import com.HotelManager.forecast.dto.MonitoringDto;
import com.HotelManager.forecast.dto.TrainRequestDto;
import com.HotelManager.forecast.service.ForecastModelService;
import com.HotelManager.forecast.service.MonitoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/forecast/models")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
@Tag(name = "Модели прогнозирования")
public class ModelController {

    private final ForecastModelService models;
    private final MonitoringService monitoring;

    @Operation(summary = "Реестр моделей")
    @GetMapping
    public List<ModelSummaryDto> list() {
        return models.list();
    }

    @Operation(summary = "Качество модели, таблица лидеров, параметры каналов, проверка вне выборки")
    @GetMapping("/{id}")
    public ModelDetailsDto get(@PathVariable Long id) {
        return models.get(id);
    }

    @Operation(summary = "Обучить модели по текущим данным (администратор)",
            description = "Сравнивает алгоритмы скользящей кросс-валидацией, выбирает лучший и делает его активным.")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/train")
    public ModelDetailsDto train(@Valid @RequestBody TrainRequestDto request, Authentication authentication) {
        return models.train(request.target(), authentication.getName());
    }

    @Operation(summary = "Сделать модель активной — откат на прежнюю версию (администратор)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/activate")
    public ModelDetailsDto activate(@PathVariable Long id) {
        return models.activate(id);
    }

    @Operation(summary = "Контроль качества: прогноз модели против фактических продаж недель после обучения")
    @GetMapping("/{id}/monitoring")
    public MonitoringDto monitoring(@PathVariable Long id) {
        return monitoring.monitor(id);
    }
}
