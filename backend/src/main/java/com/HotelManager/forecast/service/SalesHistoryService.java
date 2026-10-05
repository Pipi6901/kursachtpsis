package com.HotelManager.forecast.service;

import com.HotelManager.forecast.dto.SalesImportResult;
import com.HotelManager.forecast.dto.SalesWeekDto;
import com.HotelManager.forecast.dto.SalesWeekRequest;
import com.HotelManager.forecast.entity.DataSource;
import com.HotelManager.forecast.entity.SalesWeekly;
import com.HotelManager.forecast.exception.ForecastException;
import com.HotelManager.forecast.repo.SalesWeeklyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/** Фактические еженедельные продажи — ряд для обучения и контроля модели. */
@Service
@RequiredArgsConstructor
public class SalesHistoryService {

    private final SalesWeeklyRepository sales;

    @Transactional(readOnly = true)
    public List<SalesWeekDto> list(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : LocalDate.of(1970, 1, 1);
        LocalDate end = to != null ? to : LocalDate.of(2999, 12, 31);
        return sales.findByWeekStartBetweenOrderByWeekStartAsc(start, end).stream().map(this::toDto).toList();
    }

    /** Последние {@code weeks} недель (для таблицы ввода фактов). */
    @Transactional(readOnly = true)
    public List<SalesWeekDto> latest(int weeks) {
        List<SalesWeekly> all = sales.findAllByOrderByWeekStartAsc();
        int from = Math.max(0, all.size() - Math.max(weeks, 1));
        return all.subList(from, all.size()).stream().map(this::toDto).toList();
    }

    @Transactional
    public SalesWeekDto upsert(SalesWeekRequest request) {
        LocalDate monday = request.weekStart().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        SalesWeekly row = sales.findByWeekStart(monday).orElseGet(SalesWeekly::new);
        row.setWeekStart(monday);
        row.setBookings(request.bookings());
        row.setRevenue(request.revenue().setScale(2, RoundingMode.HALF_UP));
        row.setSource(DataSource.MANUAL);
        row.setUpdatedAt(LocalDateTime.now());
        return toDto(sales.save(row));
    }

    @Transactional
    public void delete(LocalDate weekStart) {
        LocalDate monday = weekStart.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        SalesWeekly row = sales.findByWeekStart(monday)
                .orElseThrow(() -> ForecastException.notFound("Данные за эту неделю не найдены."));
        sales.delete(row);
    }

    /** Импорт из CSV: либо загружается весь файл, либо (при ошибках в данных) ничего. */
    @Transactional
    public SalesImportResult importCsv(byte[] content) {
        SalesCsvParser.Result parsed = SalesCsvParser.parse(content);
        int created = 0;
        int updated = 0;
        List<SalesWeekly> toSave = new ArrayList<>();
        for (SalesCsvParser.Row r : parsed.rows()) {
            SalesWeekly row = sales.findByWeekStart(r.weekStart()).orElse(null);
            if (row == null) {
                row = new SalesWeekly();
                row.setWeekStart(r.weekStart());
                created++;
            } else {
                updated++;
            }
            row.setBookings(r.bookings());
            row.setRevenue(r.revenue());
            row.setSource(DataSource.IMPORT);
            row.setUpdatedAt(LocalDateTime.now());
            toSave.add(row);
        }
        sales.saveAll(toSave);
        return new SalesImportResult(created, updated, parsed.normalizedDates(), parsed.warnings());
    }

    private SalesWeekDto toDto(SalesWeekly s) {
        return new SalesWeekDto(s.getWeekStart(), s.getBookings(), s.getRevenue(), s.getSource());
    }
}
