package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/** Период, когда номер занят: ночи с {@code from} (заезд) до {@code to} (выезд, не включая). Без данных о госте. */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class BusyPeriodDTO {
    private LocalDate from;
    private LocalDate to;
}
