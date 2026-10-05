package com.HotelManager.forecast.service;

import com.HotelManager.forecast.entity.ChannelType;
import com.HotelManager.forecast.entity.DataSource;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.entity.MarketingCampaign;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.entity.SalesWeekly;
import com.HotelManager.forecast.exception.ForecastException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class DatasetAssemblerTest {

    private static final LocalDate MONDAY = LocalDate.of(2025, 1, 6);

    private static MarketingChannel channel(String code) {
        MarketingChannel c = new MarketingChannel();
        c.setCode(code);
        c.setName(code);
        c.setType(ChannelType.ONLINE_PAID);
        return c;
    }

    private static MarketingCampaign campaign(MarketingChannel ch, LocalDate from, LocalDate to, String budget) {
        MarketingCampaign c = new MarketingCampaign();
        c.setChannel(ch);
        c.setName("k");
        c.setStartDate(from);
        c.setEndDate(to);
        c.setBudget(new BigDecimal(budget));
        return c;
    }

    private static SalesWeekly week(LocalDate monday, int bookings, String revenue) {
        SalesWeekly s = new SalesWeekly();
        s.setWeekStart(monday);
        s.setBookings(bookings);
        s.setRevenue(new BigDecimal(revenue));
        s.setSource(DataSource.MANUAL);
        return s;
    }

    private static List<SalesWeekly> series(int weeks) {
        List<SalesWeekly> list = new ArrayList<>();
        for (int i = 0; i < weeks; i++) {
            list.add(week(MONDAY.plusWeeks(i), 50 + i, String.valueOf(10_000 + 100 * i)));
        }
        return list;
    }

    @Test
    void campaignBudgetIsSpreadEvenlyOverDays() {
        MarketingChannel search = channel("search");
        // ровно одна неделя пн–вс: весь бюджет попадает в неделю
        MarketingCampaign full = campaign(search, MONDAY, MONDAY.plusDays(6), "700.00");
        // семь дней со среды: 5 дней в первой неделе и 2 — во второй
        MarketingCampaign shifted = campaign(search, MONDAY.plusDays(2).plusWeeks(1), MONDAY.plusDays(8).plusWeeks(1), "700.00");
        double[][] spend = DatasetAssembler.spendMatrix(
                List.of(MONDAY, MONDAY.plusWeeks(1), MONDAY.plusWeeks(2)), List.of(full, shifted), List.of("search"));
        assertThat(spend[0][0]).isCloseTo(700.0, within(1e-9));
        assertThat(spend[1][0]).isCloseTo(500.0, within(1e-9));
        assertThat(spend[2][0]).isCloseTo(200.0, within(1e-9));
    }

    @Test
    void campaignsOutsideRangeAndOtherChannelsAreIgnored() {
        MarketingChannel search = channel("search");
        MarketingChannel other = channel("other");
        List<MarketingCampaign> campaigns = List.of(
                campaign(search, MONDAY.minusWeeks(10), MONDAY.minusWeeks(9), "1000"),
                campaign(other, MONDAY, MONDAY.plusDays(6), "999"),
                campaign(search, MONDAY.minusDays(3), MONDAY.plusDays(3), "700"));   // 7 дней, 4 из них в неделе
        double[][] spend = DatasetAssembler.spendMatrix(List.of(MONDAY, MONDAY.plusWeeks(1)), campaigns, List.of("search"));
        assertThat(spend[0][0]).isCloseTo(400.0, within(1e-9));
        assertThat(spend[1][0]).isZero();
    }

    @Test
    void assemblesAlignedDatasetForSelectedTarget() {
        MarketingChannel search = channel("search");
        List<MarketingCampaign> campaigns = List.of(campaign(search, MONDAY, MONDAY.plusWeeks(70).minusDays(1), "70000"));
        Dataset revenue = DatasetAssembler.assemble(ForecastTarget.REVENUE, series(70), campaigns, List.of(search));
        Dataset bookings = DatasetAssembler.assemble(ForecastTarget.BOOKINGS, series(70), campaigns, List.of(search));
        assertThat(revenue.size()).isEqualTo(70);
        assertThat(revenue.sales()[0]).isEqualTo(10_000.0);
        assertThat(bookings.sales()[3]).isEqualTo(53.0);
        assertThat(revenue.spend()[10][0]).isCloseTo(1000.0, within(1e-9));
        assertThat(revenue.firstWeek()).isEqualTo(MONDAY);
        assertThat(revenue.lastWeek()).isEqualTo(MONDAY.plusWeeks(69));
    }

    @Test
    void shortGapsAreInterpolatedLongGapsRejected() {
        MarketingChannel search = channel("search");
        List<SalesWeekly> data = series(70);
        data.remove(30);           // пропущена одна неделя: 80 -> среднее соседей
        Dataset ds = DatasetAssembler.assemble(ForecastTarget.BOOKINGS, data, List.of(), List.of(search));
        assertThat(ds.size()).isEqualTo(70);
        assertThat(ds.sales()[30]).isCloseTo((79 + 81) / 2.0, within(1e-9));
        assertThat(ds.warnings()).anyMatch(w -> w.contains("интерполяц"));

        List<SalesWeekly> broken = series(70);
        for (int i = 0; i < 5; i++) {
            broken.remove(20);     // пропуск в 5 недель
        }
        assertThatThrownBy(() -> DatasetAssembler.assemble(ForecastTarget.BOOKINGS, broken, List.of(), List.of(search)))
                .isInstanceOf(ForecastException.class).hasMessageContaining("пропущено 5");
    }

    @Test
    void requiresEnoughHistoryAndMondays() {
        MarketingChannel search = channel("search");
        assertThatThrownBy(() -> DatasetAssembler.assemble(ForecastTarget.REVENUE, series(30), List.of(), List.of(search)))
                .isInstanceOf(ForecastException.class).hasMessageContaining("не менее 64");
        assertThatThrownBy(() -> DatasetAssembler.assemble(ForecastTarget.REVENUE, List.of(), List.of(), List.of(search)))
                .isInstanceOf(ForecastException.class);
        List<SalesWeekly> notMonday = new ArrayList<>(series(70));
        notMonday.set(0, week(MONDAY.plusDays(1), 1, "1"));
        assertThatThrownBy(() -> DatasetAssembler.assemble(ForecastTarget.REVENUE, notMonday, List.of(), List.of(search)))
                .isInstanceOf(ForecastException.class).hasMessageContaining("понедельника");
    }

    @Test
    void inactiveChannelCampaignsProduceWarning() {
        MarketingChannel search = channel("search");
        MarketingChannel off = channel("off");
        List<MarketingCampaign> campaigns = List.of(campaign(off, MONDAY, MONDAY.plusDays(6), "100"));
        Dataset ds = DatasetAssembler.assemble(ForecastTarget.REVENUE, series(70), campaigns, List.of(search));
        assertThat(ds.warnings()).anyMatch(w -> w.contains("неактивных"));
        assertThat(ds.channelCodes()).containsExactly("search");
    }

    @Test
    void fingerprintChangesWhenDataChanges() {
        MarketingChannel search = channel("search");
        List<SalesWeekly> base = series(70);
        String a = DatasetAssembler.fingerprint(DatasetAssembler.assemble(ForecastTarget.REVENUE, base, List.of(), List.of(search)));
        String same = DatasetAssembler.fingerprint(DatasetAssembler.assemble(ForecastTarget.REVENUE, series(70), List.of(), List.of(search)));
        base.get(5).setRevenue(new BigDecimal("12345.67"));
        String changed = DatasetAssembler.fingerprint(DatasetAssembler.assemble(ForecastTarget.REVENUE, base, List.of(), List.of(search)));
        List<SalesWeekly> longer = series(71);
        String extended = DatasetAssembler.fingerprint(DatasetAssembler.assemble(ForecastTarget.REVENUE, longer, List.of(), List.of(search)));
        assertThat(a).hasSize(64).isEqualTo(same).isNotEqualTo(changed).isNotEqualTo(extended);
    }
}
