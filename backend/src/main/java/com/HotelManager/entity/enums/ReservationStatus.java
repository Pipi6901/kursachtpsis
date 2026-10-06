package com.HotelManager.entity.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ReservationStatus {

    WAITING("Ожидание"),
    DONE("Подтверждено"),
    REJECT("Отказано"),
    COMPLETED("Завершено"),
    ;
    private final String name;
}
