package com.HotelManager.forecast.service;

import com.HotelManager.forecast.exception.ForecastException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SalesCsvParserTest {

    private static byte[] bytes(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void parsesSemicolonFileWithHeaderAndRussianDates() {
        SalesCsvParser.Result r = SalesCsvParser.parse(bytes(
                "Неделя;Бронирований;Выручка\n05.01.2026;42;9 800,50\n12.01.2026;51;11200\n"));
        assertThat(r.rows()).hasSize(2);
        assertThat(r.rows().get(0).weekStart()).isEqualTo(LocalDate.of(2026, 1, 5));
        assertThat(r.rows().get(0).revenue()).isEqualByComparingTo(new BigDecimal("9800.50"));
        assertThat(r.rows().get(1).bookings()).isEqualTo(51);
    }

    @Test
    void parsesCommaSeparatedIsoFileWithBom() {
        SalesCsvParser.Result r = SalesCsvParser.parse(bytes("﻿2026-01-05,42,9800.5\r\n2026-01-12,51,11200\r\n"));
        assertThat(r.rows()).extracting(SalesCsvParser.Row::bookings).containsExactly(42, 51);
    }

    @Test
    void normalizesDatesToMondayAndKeepsLastDuplicate() {
        SalesCsvParser.Result r = SalesCsvParser.parse(bytes("2026-01-07;10;100\n2026-01-05;20;200\n"));
        assertThat(r.rows()).hasSize(1);
        assertThat(r.rows().get(0).weekStart()).isEqualTo(LocalDate.of(2026, 1, 5));
        assertThat(r.rows().get(0).bookings()).isEqualTo(20);
        assertThat(r.normalizedDates()).isEqualTo(1);
        assertThat(r.warnings()).hasSize(2);
    }

    @Test
    void reportsAllErrorsWithoutLoadingAnything() {
        assertThatThrownBy(() -> SalesCsvParser.parse(bytes("2026-01-05;10;100\nplohaya;1;1\n2026-01-12;-3;5\n2026-01-19;x;5\n2026-01-26;1\n")))
                .isInstanceOf(ForecastException.class)
                .hasMessageContaining("строка 2").hasMessageContaining("строка 3")
                .hasMessageContaining("строка 4").hasMessageContaining("строка 5");
    }

    @Test
    void rejectsEmptyOversizedAndTooLongFiles() {
        assertThatThrownBy(() -> SalesCsvParser.parse(new byte[0])).isInstanceOf(ForecastException.class);
        assertThatThrownBy(() -> SalesCsvParser.parse(new byte[SalesCsvParser.MAX_BYTES + 1]))
                .isInstanceOf(ForecastException.class).hasMessageContaining("слишком большой");
        assertThatThrownBy(() -> SalesCsvParser.parse(bytes("Неделя;Брони;Выручка\n")))
                .isInstanceOf(ForecastException.class).hasMessageContaining("нет строк");
        StringBuilder many = new StringBuilder();
        LocalDate d = LocalDate.of(2000, 1, 3);
        for (int i = 0; i <= SalesCsvParser.MAX_ROWS; i++) {
            many.append(d.plusWeeks(i)).append(";1;1\n");
        }
        assertThatThrownBy(() -> SalesCsvParser.parse(bytes(many.toString())))
                .isInstanceOf(ForecastException.class).hasMessageContaining("больше");
    }
}
