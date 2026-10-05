package com.HotelManager.forecast.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class FallbackForecasterTest {

    private static final LocalDate ORIGIN = LocalDate.of(2026, 10, 5);

    @Test
    void usesSameWeekOfLastYearAdjustedByGrowth() {
        double[] history = new double[80];
        for (int i = 0; i < history.length; i++) {
            history[i] = 100 + 20 * Math.sin(2 * Math.PI * i / 52) + (i >= 52 ? 10 : 0);   // рост на 10 ед. во втором году
        }
        List<FallbackForecaster.Point> points = FallbackForecaster.forecast(history, ORIGIN, 4);
        assertThat(points).hasSize(4);
        assertThat(points.get(0).weekStart()).isEqualTo(ORIGIN);
        double growth = mean(history, 67, 80) / mean(history, 15, 28);
        assertThat(points.get(0).predicted()).isCloseTo(history[80 - 52] * growth, within(1e-9));
        assertThat(points.get(3).weekStart()).isEqualTo(ORIGIN.plusWeeks(3));
    }

    @Test
    void shortHistoryFallsBackToRecentAverage() {
        double[] history = new double[20];
        for (int i = 0; i < history.length; i++) {
            history[i] = i;
        }
        List<FallbackForecaster.Point> points = FallbackForecaster.forecast(history, ORIGIN, 3);
        assertThat(points).allSatisfy(p -> assertThat(p.predicted()).isCloseTo(15.5, within(1e-9)));
    }

    @Test
    void intervalIsAroundForecastNonNegativeAndWidens() {
        double[] history = new double[70];
        java.util.Arrays.fill(history, 100.0);
        List<FallbackForecaster.Point> points = FallbackForecaster.forecast(history, ORIGIN, 30);
        for (FallbackForecaster.Point p : points) {
            assertThat(p.lower()).isBetween(0.0, p.predicted());
            assertThat(p.upper()).isGreaterThan(p.predicted());
        }
        double early = points.get(0).upper() - points.get(0).lower();
        double late = points.get(29).upper() - points.get(29).lower();
        assertThat(late).isGreaterThan(early);
    }

    @Test
    void growthIsBounded() {
        double[] history = new double[80];
        for (int i = 0; i < history.length; i++) {
            history[i] = i >= 67 ? 1000 : 10;       // скачок в 100 раз: поправка ограничена 1,5
        }
        double predicted = FallbackForecaster.forecast(history, ORIGIN, 1).get(0).predicted();
        assertThat(predicted).isCloseTo(history[28] * 1.5, within(1e-9));
    }

    private static double mean(double[] a, int from, int to) {
        double s = 0;
        for (int i = from; i < to; i++) {
            s += a[i];
        }
        return s / (to - from);
    }
}
