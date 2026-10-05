package com.HotelManager.forecast.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Маркетинговая активность (кампания): бюджет канала на период.
 * Прошедшие кампании — история затрат для обучения модели, будущие — план, по которому строится прогноз.
 * Бюджет равномерно распределяется по дням периода.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "mk_campaign", indexes = {
        @Index(name = "idx_mk_campaign_channel", columnList = "channel_id"),
        @Index(name = "idx_mk_campaign_period", columnList = "start_date, end_date")})
@Check(constraints = "end_date >= start_date AND budget >= 0")
public class MarketingCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private MarketingChannel channel;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal budget;

    @Column(length = 500)
    private String note;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
