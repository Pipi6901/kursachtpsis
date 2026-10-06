package com.HotelManager.forecast.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Справочник алгоритмов прогнозирования интеллектуального сервиса. Название и признак «учитывает маркетинг»
 * зависят от алгоритма, а не от конкретной модели, поэтому вынесены из таблиц моделей (3НФ).
 * Записи пополняются автоматически по ответу сервиса при обучении.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fc_algorithm")
public class ForecastAlgorithm {

    /** Код алгоритма в интеллектуальном сервисе: seasonal_naive, holt_winters, mmm_ridge, gbm. */
    @Id
    @Column(length = 40)
    private String code;

    @Column(nullable = false, length = 100)
    private String label;

    /** Учитывает ли алгоритм маркетинговые затраты (реагирует ли на сценарий). */
    @Column(name = "scenario_aware", nullable = false)
    private boolean scenarioAware;
}
