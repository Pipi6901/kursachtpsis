package com.HotelManager.forecast.service;

import com.HotelManager.forecast.dto.CampaignDto;
import com.HotelManager.forecast.dto.CampaignRequest;
import com.HotelManager.forecast.dto.PageDto;
import com.HotelManager.forecast.entity.MarketingCampaign;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.exception.ForecastException;
import com.HotelManager.forecast.repo.MarketingCampaignRepository;
import com.HotelManager.forecast.repo.MarketingChannelRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** Управление маркетинговыми активностями (кампаниями). */
@Service
@RequiredArgsConstructor
public class CampaignService {

    /** Максимальная длительность кампании — защита от опечаток в датах. */
    static final long MAX_DAYS = 400;

    private final MarketingCampaignRepository campaigns;
    private final MarketingChannelRepository channels;

    @Transactional(readOnly = true)
    public PageDto<CampaignDto> search(Long channelId, LocalDate from, LocalDate to, int page, int size) {
        Specification<MarketingCampaign> spec = (root, query, cb) -> {
            if (!Long.class.equals(query.getResultType()) && !long.class.equals(query.getResultType())) {
                root.fetch("channel");  // не в запросе подсчёта
            }
            List<Predicate> predicates = new ArrayList<>();
            if (channelId != null) {
                predicates.add(cb.equal(root.get("channel").get("id"), channelId));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("endDate"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("startDate"), to));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200),
                Sort.by(Sort.Order.desc("startDate"), Sort.Order.desc("id")));
        Page<MarketingCampaign> result = campaigns.findAll(spec, pageable);
        return new PageDto<>(result.getContent().stream().map(this::toDto).toList(), result.getTotalElements(),
                result.getNumber(), result.getSize(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public CampaignDto get(Long id) {
        return toDto(find(id));
    }

    @Transactional
    public CampaignDto create(CampaignRequest request, String username) {
        MarketingCampaign campaign = new MarketingCampaign();
        campaign.setCreatedBy(username);
        apply(campaign, request);
        return toDto(campaigns.save(campaign));
    }

    @Transactional
    public CampaignDto update(Long id, CampaignRequest request) {
        MarketingCampaign campaign = find(id);
        apply(campaign, request);
        return toDto(campaigns.save(campaign));
    }

    @Transactional
    public void delete(Long id) {
        campaigns.delete(find(id));
    }

    private MarketingCampaign find(Long id) {
        return campaigns.findWithChannelById(id)
                .orElseThrow(() -> ForecastException.notFound("Кампания не найдена."));
    }

    private void apply(MarketingCampaign campaign, CampaignRequest r) {
        if (r.endDate().isBefore(r.startDate())) {
            throw ForecastException.badRequest("Дата окончания не может быть раньше даты начала.");
        }
        if (ChronoUnit.DAYS.between(r.startDate(), r.endDate()) + 1 > MAX_DAYS) {
            throw ForecastException.badRequest("Кампания не может длиться дольше " + MAX_DAYS
                    + " дней — разбейте её на несколько.");
        }
        MarketingChannel channel = channels.findById(r.channelId())
                .orElseThrow(() -> ForecastException.badRequest("Выбранный канал не найден."));
        if (!channel.isActive()) {
            throw ForecastException.badRequest("Канал «" + channel.getName() + "» отключён.");
        }
        campaign.setChannel(channel);
        campaign.setName(r.name().trim());
        campaign.setStartDate(r.startDate());
        campaign.setEndDate(r.endDate());
        campaign.setBudget(r.budget().setScale(2, RoundingMode.HALF_UP));
        campaign.setNote(r.note() == null || r.note().isBlank() ? null : r.note().trim());
    }

    private CampaignDto toDto(MarketingCampaign c) {
        long days = ChronoUnit.DAYS.between(c.getStartDate(), c.getEndDate()) + 1;
        BigDecimal weekly = c.getBudget().multiply(BigDecimal.valueOf(7))
                .divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);
        LocalDate today = LocalDate.now();
        String status = c.getEndDate().isBefore(today) ? "COMPLETED"
                : c.getStartDate().isAfter(today) ? "PLANNED" : "ACTIVE";
        return new CampaignDto(c.getId(), c.getChannel().getId(), c.getChannel().getCode(), c.getChannel().getName(),
                c.getName(), c.getStartDate(), c.getEndDate(), c.getBudget(), weekly, (int) days, status,
                c.getNote(), c.getCreatedBy());
    }
}
