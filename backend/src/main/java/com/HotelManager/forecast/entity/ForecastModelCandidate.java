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

/** Результат одного алгоритма-кандидата при обучении (таблица лидеров). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fc_model_candidate")
public class ForecastModelCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "model_id", nullable = false)
    private ForecastModel model;

    @Column(nullable = false, length = 40)
    private String algorithm;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "scenario_aware", nullable = false)
    private boolean scenarioAware;

    @Column(nullable = false)
    private boolean selected;

    private Double wape;

    private Double mape;

    private Double rmse;

    /** Выигрыш точности относительно сезонной наивной модели (доля). */
    @Column(name = "skill_vs_naive")
    private Double skillVsNaive;

    @Column(name = "skipped_reason", length = 300)
    private String skippedReason;
}
