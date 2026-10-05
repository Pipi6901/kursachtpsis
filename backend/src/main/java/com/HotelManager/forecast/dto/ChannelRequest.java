package com.HotelManager.forecast.dto;

import com.HotelManager.forecast.entity.ChannelType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChannelRequest(
        @NotBlank(message = "укажите код канала")
        @Pattern(regexp = "^[a-z0-9_]{2,40}$", message = "код — 2–40 символов: строчные латинские буквы, цифры, подчёркивание")
        String code,
        @NotBlank(message = "укажите название канала")
        @Size(max = 100, message = "не более 100 символов")
        String name,
        @NotNull(message = "укажите тип канала")
        ChannelType type,
        @Size(max = 300, message = "не более 300 символов")
        String description,
        Boolean active,
        Integer sortOrder) {
}
