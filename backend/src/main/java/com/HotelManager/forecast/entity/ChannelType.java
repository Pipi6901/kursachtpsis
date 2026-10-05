package com.HotelManager.forecast.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Тип маркетингового канала. */
@Getter
@AllArgsConstructor
public enum ChannelType {
    ONLINE_PAID("Онлайн: платная реклама"),
    ONLINE_OWNED("Онлайн: собственные каналы"),
    PARTNER("Партнёры"),
    OFFLINE("Офлайн");

    private final String title;
}
