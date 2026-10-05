package com.HotelManager.forecast.controller;

import com.HotelManager.forecast.dto.SalesImportResult;
import com.HotelManager.forecast.dto.SalesWeekDto;
import com.HotelManager.forecast.dto.SalesWeekRequest;
import com.HotelManager.forecast.exception.ForecastException;
import com.HotelManager.forecast.service.SalesHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/forecast/sales")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
@Tag(name = "Фактические продажи по неделям")
public class SalesController {

    private final SalesHistoryService service;

    @Operation(summary = "Продажи по неделям: за период либо последние N недель (latest)")
    @GetMapping
    public List<SalesWeekDto> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer latest) {
        return latest != null ? service.latest(latest) : service.list(from, to);
    }

    @Operation(summary = "Внести или исправить факт продаж за неделю (дата приводится к понедельнику)")
    @PutMapping
    public SalesWeekDto upsert(@Valid @RequestBody SalesWeekRequest request) {
        return service.upsert(request);
    }

    @Operation(summary = "Удалить данные за неделю (администратор)")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{weekStart}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        service.delete(weekStart);
    }

    @Operation(summary = "Загрузить историю продаж из CSV (администратор)",
            description = "Столбцы: неделя; бронирований; выручка. Разделитель «;» или «,», даты гггг-мм-дд или дд.мм.гггг.")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SalesImportResult importCsv(@RequestParam("file") MultipartFile file) {
        try {
            return service.importCsv(file.getBytes());
        } catch (IOException e) {
            throw ForecastException.badRequest("Не удалось прочитать файл.");
        }
    }
}
