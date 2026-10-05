package com.HotelManager.forecast.service;

import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.entity.MarketingCampaign;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.repo.MarketingCampaignRepository;
import com.HotelManager.forecast.repo.MarketingChannelRepository;
import com.HotelManager.forecast.repo.SalesWeeklyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Доступ к данным модуля: обучающий набор, плановые затраты на будущие недели. */
@Service
@RequiredArgsConstructor
public class ForecastDataService {

    private final SalesWeeklyRepository sales;
    private final MarketingCampaignRepository campaigns;
    private final MarketingChannelRepository channels;

    /** Обучающий набор по всей истории продаж и активным каналам. */
    @Transactional(readOnly = true)
    public Dataset trainingDataset(ForecastTarget target) {
        List<MarketingChannel> active = channels.findAllByActiveTrueOrderBySortOrderAscIdAsc();
        var salesRows = sales.findAllByOrderByWeekStartAsc();
        List<MarketingCampaign> overlapping = salesRows.isEmpty() ? List.of()
                : campaigns.findOverlapping(salesRows.get(0).getWeekStart(),
                salesRows.get(salesRows.size() - 1).getWeekStart().plusDays(6));
        return DatasetAssembler.assemble(target, salesRows, overlapping, active);
    }

    /**
     * Затраты по каналам для {@code count} недель начиная с {@code firstWeek}: фактические для прошедших
     * недель и плановые для будущих (кампании одинаково описывают и то, и другое).
     */
    @Transactional(readOnly = true)
    public double[][] spendFor(LocalDate firstWeek, int count, List<String> channelCodes) {
        List<LocalDate> weeks = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            weeks.add(firstWeek.plusWeeks(i));
        }
        List<MarketingCampaign> overlapping = campaigns.findOverlapping(firstWeek, firstWeek.plusWeeks(count).minusDays(1));
        return DatasetAssembler.spendMatrix(weeks, overlapping, channelCodes);
    }

    @Transactional(readOnly = true)
    public List<MarketingChannel> channelsByCodes(List<String> codes) {
        return codes.stream().map(code -> channels.findByCode(code).orElse(null))
                .filter(java.util.Objects::nonNull).toList();
    }
}
