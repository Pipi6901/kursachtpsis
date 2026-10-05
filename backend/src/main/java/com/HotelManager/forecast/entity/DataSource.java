package com.HotelManager.forecast.entity;

/** Происхождение строки фактических продаж. */
public enum DataSource {
    DEMO,    // демонстрационные данные
    IMPORT,  // загрузка из CSV
    MANUAL   // ручной ввод в интерфейсе
}
