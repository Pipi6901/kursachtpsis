package com.HotelManager.forecast.controller;

import com.HotelManager.forecast.dto.ChannelDto;
import com.HotelManager.forecast.dto.ChannelRequest;
import com.HotelManager.forecast.service.ChannelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/forecast/channels")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
@Tag(name = "Маркетинговые каналы")
public class ChannelController {

    private final ChannelService service;

    @Operation(summary = "Список каналов")
    @GetMapping
    public List<ChannelDto> list() {
        return service.list();
    }

    @Operation(summary = "Добавить канал (администратор)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelDto create(@Valid @RequestBody ChannelRequest request) {
        return service.create(request);
    }

    @Operation(summary = "Изменить канал (администратор); код канала изменить нельзя")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ChannelDto update(@PathVariable Long id, @Valid @RequestBody ChannelRequest request) {
        return service.update(id, request);
    }

    @Operation(summary = "Удалить канал (администратор); канал с кампаниями удалить нельзя")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
