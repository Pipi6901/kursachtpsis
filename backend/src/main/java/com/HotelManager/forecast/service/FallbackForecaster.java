package com.HotelManager.forecast.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Упрощённый прогноз «на случай недоступности интеллектуального сервиса» (деградация вместо отказа).
 * Это классический расчёт без обучения и без учёта маркетинга: значение той же недели прошлого года,
 * скорректированное на изменение уровня продаж; при истории короче года — среднее последних недель.
 * Интервал приблизительный (±{@value #HALF_WIDTH}).
 */
public final class FallbackForecaster {

    static final double HALF_WIDTH = 0.15;
    private static final int SEASON = 52;
    private static final int LEVEL_WINDOW = 13;

    public record Point(LocalDate weekStart, double predicted, double lower, double upper) {
    }

    private FallbackForecaster() {
    }

    /** @param history фактические продажи подряд по неделям (последний элемент — неделя перед origin) */
    public static List<Point> forecast(double[] history, LocalDate origin, int horizonWeeks) {
        int n = history.length;
        if (n == 0) {
            throw new IllegalArgumentException("история продаж пуста");
        }
        double growth = 1.0;
        if (n >= SEASON + LEVEL_WINDOW) {
            double recent = mean(history, n - LEVEL_WINDOW, n);
            double yearAgo = mean(history, n - LEVEL_WINDOW - SEASON, n - SEASON);
            if (yearAgo > 0) {
                growth = Math.min(1.5, Math.max(0.7, recent / yearAgo));
            }
        }
        double[] series = new double[n + horizonWeeks];
        System.arraycopy(history, 0, series, 0, n);
        double flat = mean(history, Math.max(0, n - 8), n);
        List<Point> out = new ArrayList<>(horizonWeeks);
        for (int i = 0; i < horizonWeeks; i++) {
            int idx = n + i;
            double predicted = n >= SEASON ? series[idx - SEASON] * growth : flat;
            series[idx] = predicted;        // для горизонтов дальше года используем собственный прогноз
            double widen = 1.0 + 0.02 * Math.max(0, i + 1 - 12);
            out.add(new Point(origin.plusWeeks(i), predicted,
                    Math.max(0.0, predicted * (1 - HALF_WIDTH * widen)), predicted * (1 + HALF_WIDTH * widen)));
        }
        return out;
    }

    private static double mean(double[] a, int from, int to) {
        double sum = 0;
        for (int i = from; i < to; i++) {
            sum += a[i];
        }
        return sum / (to - from);
    }
}
