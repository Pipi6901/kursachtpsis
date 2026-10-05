package com.HotelManager.forecast.service;

import com.HotelManager.forecast.dto.ChannelDto;
import com.HotelManager.forecast.dto.ChannelRequest;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.exception.ForecastException;
import com.HotelManager.forecast.repo.ForecastModelRepository;
import com.HotelManager.forecast.repo.MarketingCampaignRepository;
import com.HotelManager.forecast.repo.MarketingChannelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Справочник маркетинговых каналов. */
@Service
@RequiredArgsConstructor
public class ChannelService {

    private final MarketingChannelRepository channels;
    private final MarketingCampaignRepository campaigns;
    private final ForecastModelRepository models;

    @Transactional(readOnly = true)
    public List<ChannelDto> list() {
        return channels.findAllByOrderBySortOrderAscIdAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public ChannelDto create(ChannelRequest request) {
        if (channels.existsByCode(request.code())) {
            throw ForecastException.conflict("Канал с кодом «" + request.code() + "» уже существует.");
        }
        MarketingChannel channel = new MarketingChannel();
        channel.setCode(request.code());
        apply(channel, request);
        if (request.sortOrder() == null) {
            channel.setSortOrder((int) channels.count() + 1);
        }
        return toDto(channels.save(channel));
    }

    /** Код канала неизменяем: на него ссылается обмен с ML-сервисом и обученные модели. */
    @Transactional
    public ChannelDto update(Long id, ChannelRequest request) {
        MarketingChannel channel = find(id);
        if (!channel.getCode().equals(request.code())) {
            throw ForecastException.badRequest("Код канала изменить нельзя — создайте новый канал.");
        }
        apply(channel, request);
        return toDto(channels.save(channel));
    }

    @Transactional
    public void delete(Long id) {
        MarketingChannel channel = find(id);
        if (campaigns.countByChannelId(id) > 0) {
            throw ForecastException.conflict("Канал нельзя удалить: на него ссылаются кампании. "
                    + "Отключите канал, чтобы исключить его из расчётов.");
        }
        boolean usedByModels = models.findAll().stream()
                .anyMatch(m -> m.getEffects().stream().anyMatch(e -> e.getChannel().getId().equals(id)));
        if (usedByModels) {
            throw ForecastException.conflict("Канал нельзя удалить: он входит в обученные модели. "
                    + "Отключите канал, чтобы исключить его из расчётов.");
        }
        channels.delete(channel);
    }

    private MarketingChannel find(Long id) {
        return channels.findById(id).orElseThrow(() -> ForecastException.notFound("Канал не найден."));
    }

    private void apply(MarketingChannel channel, ChannelRequest request) {
        channel.setName(request.name().trim());
        channel.setType(request.type());
        channel.setDescription(request.description() == null || request.description().isBlank()
                ? null : request.description().trim());
        if (request.active() != null) {
            channel.setActive(request.active());
        }
        if (request.sortOrder() != null) {
            channel.setSortOrder(request.sortOrder());
        }
    }

    private ChannelDto toDto(MarketingChannel c) {
        return new ChannelDto(c.getId(), c.getCode(), c.getName(), c.getType(), c.getType().getTitle(),
                c.getDescription(), c.isActive(), c.getSortOrder(), campaigns.countByChannelId(c.getId()));
    }
}
