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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Оценённое моделью влияние канала: вклад, окупаемость, насыщение, перенос эффекта. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fc_model_channel_effect",
        uniqueConstraints = @UniqueConstraint(columnNames = {"model_id", "channel_id"}))
public class ForecastModelChannelEffect {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "model_id", nullable = false)
    private ForecastModel model;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private MarketingChannel channel;

    @Column(name = "adstock_decay", nullable = false)
    private double adstockDecay;

    @Column(name = "saturation_scale", nullable = false)
    private double saturationScale;

    @Column(name = "max_effect", nullable = false)
    private double maxEffect;

    @Column(name = "total_spend", nullable = false)
    private double totalSpend;

    @Column(name = "active_weeks", nullable = false)
    private int activeWeeks;

    @Column(name = "spend_cv", nullable = false)
    private double spendCv;

    @Column(name = "contribution_total", nullable = false)
    private double contributionTotal;

    @Column(name = "contribution_share", nullable = false)
    private double contributionShare;

    @Column(name = "marginal_roi")
    private Double marginalRoi;

    @Column(name = "saturation_level", nullable = false)
    private double saturationLevel;

    @Column(name = "low_variation", nullable = false)
    private boolean lowVariation;

    /** Возврат на единицу затрат (вклад / затраты). Выводится из хранимых величин, поэтому отдельно не хранится. */
    public Double getRoi() {
        return totalSpend > 0 ? contributionTotal / totalSpend : null;
    }

    /** Средние недельные затраты за обучающий период (затраты / число недель ряда). */
    public double getMeanWeeklySpend() {
        return totalSpend / model.getObservations();
    }
}
