package com.HotelManager.forecast.service;

import java.time.LocalDate;
import java.util.List;

/**
 * Выровненный недельный набор данных: продажи и затраты по каналам для одних и тех же недель.
 * {@code spend[i][c]} — затраты на неделе i по каналу c (порядок каналов — как в {@code channelCodes}).
 */
public record Dataset(List<LocalDate> weeks, double[] sales, List<String> channelCodes, double[][] spend,
                      List<String> warnings) {

    public int size() {
        return weeks.size();
    }

    public LocalDate firstWeek() {
        return weeks.get(0);
    }

    public LocalDate lastWeek() {
        return weeks.get(weeks.size() - 1);
    }
}
