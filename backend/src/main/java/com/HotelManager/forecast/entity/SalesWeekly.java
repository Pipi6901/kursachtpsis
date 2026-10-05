package com.HotelManager.forecast.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Фактические продажи за неделю (ряд для обучения модели). Отдельная таблица модуля:
 * данные основной системы (брони, чеки) не изменяются и не читаются при обучении.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fc_sales_weekly")
@Check(constraints = "bookings >= 0 AND revenue >= 0")
public class SalesWeekly {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Дата понедельника недели. */
    @Column(name = "week_start", nullable = false, unique = true)
    private LocalDate weekStart;

    @Column(nullable = false)
    private int bookings;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal revenue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DataSource source;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
