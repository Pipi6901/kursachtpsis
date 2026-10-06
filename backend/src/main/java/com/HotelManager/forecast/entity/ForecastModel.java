package com.HotelManager.forecast.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Запись реестра моделей на стороне сервера. Сами артефакты обучения хранятся на узле ML-сервиса;
 * здесь — метаданные жизненного цикла (кто и когда обучил, на каких данных, какое качество),
 * которые остаются доступными, даже если интеллектуальный сервис временно недоступен.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fc_model")
public class ForecastModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Идентификатор модели в реестре ML-сервиса. */
    @Column(name = "external_id", nullable = false, unique = true, length = 64)
    private String externalId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ForecastTarget target;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ModelStatus status = ModelStatus.ACTIVE;

    /** Алгоритм-«чемпион»; название и свойства — в справочнике алгоритмов. */
    @ManyToOne(optional = false)
    @JoinColumn(name = "algorithm", nullable = false)
    private ForecastAlgorithm algorithm;

    @Column(name = "trained_at", nullable = false)
    private LocalDateTime trainedAt;

    @Column(name = "trained_by", length = 50)
    private String trainedBy;

    @Column(name = "data_from", nullable = false)
    private LocalDate dataFrom;

    @Column(name = "data_to", nullable = false)
    private LocalDate dataTo;

    private Double wape;

    private Double mape;

    private Double smape;

    private Double rmse;

    private Double bias;

    @Column(name = "cv_folds", nullable = false)
    private int cvFolds;

    @Column(name = "cv_horizon", nullable = false)
    private int cvHorizon;

    @Column(name = "interval_level", nullable = false)
    private double intervalLevel;

    /** Отпечаток обучающих данных: по нему определяется устаревание модели. */
    @Column(name = "data_fingerprint", nullable = false, length = 64)
    private String dataFingerprint;

    @OneToMany(mappedBy = "model", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ForecastModelCandidate> candidates = new ArrayList<>();

    @OneToMany(mappedBy = "model", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ForecastModelChannelEffect> effects = new ArrayList<>();

    @OneToMany(mappedBy = "model", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("weekStart ASC")
    private List<ForecastModelBacktestPoint> backtest = new ArrayList<>();

    /** Число недель обучающего ряда. Ряд непрерывный, поэтому величина выводится из границ периода и не хранится. */
    public int getObservations() {
        return (int) ChronoUnit.WEEKS.between(dataFrom, dataTo) + 1;
    }

    @ElementCollection
    @CollectionTable(name = "fc_model_warning", joinColumns = @JoinColumn(name = "model_id"))
    @OrderColumn(name = "position")
    @Column(name = "message", nullable = false, length = 500)
    private List<String> warnings = new ArrayList<>();
}
