package com.HotelManager.entity.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum Beds {
    ONE("Один"),
    TWO("Два"),
    FOUR("Четыре"),
    SIX("Шесть"),
    EIGHT("Восемь"),
    ;
    private final String name;
}

