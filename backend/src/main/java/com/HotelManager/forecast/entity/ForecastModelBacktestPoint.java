package com.HotelManager.forecast.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** Точка проверки модели вне выборки: прогноз на неделю, которую модель не видела, и факт. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fc_model_backtest_point")
public class ForecastModelBacktestPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "model_id", nullable = false)
    private ForecastModel model;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(nullable = false)
    private double actual;

    @Column(nullable = false)
    private double predicted;

    @Column(nullable = false)
    private double lower;

    @Column(nullable = false)
    private double upper;
}
