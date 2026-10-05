package com.HotelManager.forecast.service;

import com.HotelManager.forecast.exception.ForecastException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Разбор CSV с фактическими продажами: столбцы «неделя; бронирований; выручка».
 * Разделитель — «;» или «,» (определяется по первой строке), даты — гггг-мм-дд или дд.мм.гггг,
 * десятичный разделитель — точка или запятая. Заголовок необязателен. Даты приводятся к понедельнику недели.
 */
public final class SalesCsvParser {

    public static final int MAX_ROWS = 2000;
    public static final int MAX_BYTES = 1_000_000;
    private static final int MAX_ERRORS = 10;
    private static final DateTimeFormatter RU_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    public record Row(LocalDate weekStart, int bookings, BigDecimal revenue) {
    }

    public record Result(List<Row> rows, int normalizedDates, List<String> warnings) {
    }

    private SalesCsvParser() {
    }

    public static Result parse(byte[] content) {
        if (content.length == 0) {
            throw ForecastException.badRequest("Файл пуст.");
        }
        if (content.length > MAX_BYTES) {
            throw ForecastException.badRequest("Файл слишком большой (допустимо до 1 МБ).");
        }
        String text = new String(content, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) {
            text = text.substring(1);   // BOM из Excel
        }
        String[] lines = text.split("\\R");
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<LocalDate, Row> byWeek = new LinkedHashMap<>();
        char delimiter = ';';
        boolean delimiterKnown = false;
        int normalized = 0;
        int duplicates = 0;
        int dataRows = 0;

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isEmpty()) {
                continue;
            }
            if (!delimiterKnown) {
                delimiter = line.contains(";") ? ';' : ',';
                delimiterKnown = true;
            }
            String[] cells = line.split(java.util.regex.Pattern.quote(String.valueOf(delimiter)), -1);
            if (cells.length < 3) {
                addError(errors, i + 1, "ожидается 3 столбца: неделя, бронирования, выручка");
                continue;
            }
            LocalDate date = parseDate(cells[0].strip());
            if (date == null) {
                if (dataRows == 0 && !isInteger(cells[1])) {
                    continue;   // заголовок: в первой строке и дата, и число бронирований — не числа
                }
                addError(errors, i + 1, "не удалось разобрать дату «" + cells[0].strip() + "»");
                continue;
            }
            dataRows++;
            if (dataRows > MAX_ROWS) {
                throw ForecastException.badRequest("В файле больше " + MAX_ROWS + " строк данных.");
            }
            int bookings;
            BigDecimal revenue;
            try {
                bookings = Integer.parseInt(cells[1].strip());
                revenue = new BigDecimal(cells[2].strip().replace(" ", "").replace(',', '.'));
            } catch (NumberFormatException e) {
                addError(errors, i + 1, "число бронирований должно быть целым, выручка — числом");
                continue;
            }
            if (bookings < 0 || revenue.signum() < 0) {
                addError(errors, i + 1, "значения не могут быть отрицательными");
                continue;
            }
            if (revenue.compareTo(new BigDecimal("99999999999.99")) > 0 || bookings > 1_000_000) {
                addError(errors, i + 1, "слишком большое значение");
                continue;
            }
            LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            if (!monday.equals(date)) {
                normalized++;
            }
            if (byWeek.put(monday, new Row(monday, bookings, revenue.setScale(2, java.math.RoundingMode.HALF_UP))) != null) {
                duplicates++;
            }
        }
        if (!errors.isEmpty()) {
            throw ForecastException.badRequest("Файл не загружен, найдены ошибки: " + String.join("; ", errors));
        }
        if (byWeek.isEmpty()) {
            throw ForecastException.badRequest("В файле нет строк с данными.");
        }
        if (normalized > 0) {
            warnings.add("Даты, не являющиеся понедельником, приведены к началу недели: " + normalized + ".");
        }
        if (duplicates > 0) {
            warnings.add("Повторяющиеся недели: использована последняя строка (" + duplicates + ").");
        }
        return new Result(new ArrayList<>(byWeek.values()), normalized, warnings);
    }

    private static boolean isInteger(String value) {
        try {
            Integer.parseInt(value.strip());
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static void addError(List<String> errors, int line, String message) {
        if (errors.size() < MAX_ERRORS) {
            errors.add("строка " + line + " — " + message);
        } else if (errors.size() == MAX_ERRORS) {
            errors.add("…");
        }
    }

    private static LocalDate parseDate(String value) {
        for (DateTimeFormatter formatter : new DateTimeFormatter[]{DateTimeFormatter.ISO_LOCAL_DATE, RU_DATE}) {
            try {
                return LocalDate.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // пробуем следующий формат
            }
        }
        return null;
    }
}
