package com.HotelManager.forecast.seed;

import com.HotelManager.forecast.config.ForecastProperties;
import com.HotelManager.forecast.entity.ChannelType;
import com.HotelManager.forecast.entity.DataSource;
import com.HotelManager.forecast.entity.MarketingCampaign;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.entity.SalesWeekly;
import com.HotelManager.forecast.repo.ForecastModelRepository;
import com.HotelManager.forecast.repo.MarketingCampaignRepository;
import com.HotelManager.forecast.repo.MarketingChannelRepository;
import com.HotelManager.forecast.repo.SalesWeeklyRepository;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Загрузка демонстрационных данных при первом запуске. Записывает данные ТОЛЬКО в новые таблицы модуля
 * (mk_*, fc_*) и только если все они пусты; таблицы основной системы (номера, бронирования, чеки,
 * пользователи) не читаются и не изменяются. Отключается свойством forecast.demo-data.enabled=false.
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class DemoDataSeeder implements ApplicationRunner {

    static final String RESOURCE = "demo/forecast-demo-data.json";

    private final ForecastProperties properties;
    private final MarketingChannelRepository channels;
    private final MarketingCampaignRepository campaigns;
    private final SalesWeeklyRepository sales;
    private final ForecastModelRepository models;
    private final ObjectMapper objectMapper;
    private final PlatformTransactionManager transactionManager;

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (!properties.demoData().enabled()) {
            return;
        }
        if (channels.count() > 0 || campaigns.count() > 0 || sales.count() > 0 || models.count() > 0) {
            log.info("Демонстрационные данные прогноза не загружены: таблицы модуля уже содержат данные");
            return;
        }
        DemoDataFile file;
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            file = objectMapper.readValue(in, DemoDataFile.class);
        }
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> load(file));
        log.info("Загружены демонстрационные данные прогноза: каналов {}, кампаний {}, недель продаж {}",
                file.channels().size(), file.campaigns().size(), file.sales().size());
    }

    private void load(DemoDataFile file) {
        Map<String, MarketingChannel> byCode = new HashMap<>();
        int order = 1;
        for (DemoDataFile.Channel c : file.channels()) {
            MarketingChannel channel = new MarketingChannel();
            channel.setCode(c.code());
            channel.setName(c.name());
            channel.setType(ChannelType.valueOf(c.type()));
            channel.setDescription(c.description());
            channel.setActive(true);
            channel.setSortOrder(order++);
            byCode.put(c.code(), channels.save(channel));
        }
        List<MarketingCampaign> campaignRows = file.campaigns().stream().map(c -> {
            MarketingCampaign campaign = new MarketingCampaign();
            campaign.setChannel(byCode.get(c.channel()));
            campaign.setName(c.name());
            campaign.setStartDate(c.startDate());
            campaign.setEndDate(c.endDate());
            campaign.setBudget(c.budget());
            campaign.setCreatedBy("demo");
            return campaign;
        }).toList();
        campaigns.saveAll(campaignRows);
        List<SalesWeekly> salesRows = file.sales().stream().map(s -> {
            SalesWeekly row = new SalesWeekly();
            row.setWeekStart(s.weekStart());
            row.setBookings(s.bookings());
            row.setRevenue(s.revenue());
            row.setSource(DataSource.DEMO);
            return row;
        }).toList();
        sales.saveAll(salesRows);
    }
}
