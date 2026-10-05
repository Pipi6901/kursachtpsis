package com.HotelManager.forecast.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.HotelManager.forecast.ai.AiUnavailableException;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.service.ForecastModelService;
import com.HotelManager.utils.JwtTokenUtils;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ForecastApiIntegrationTest extends ForecastIntegrationTestBase {

    @Autowired
    private JwtTokenUtils jwt;
    @Autowired
    private ForecastModelService modelService;

    private String bearer(String username, String role) {
        return "Bearer " + jwt.generateToken(new User(username, "x", List.of(new SimpleGrantedAuthority(role))));
    }

    @Test
    void jwtTokensDriveRoleChecks() throws Exception {
        mvc.perform(get("/api/forecast/channels").header("Authorization", bearer("m", "ROLE_MANAGER")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/forecast/channels").header("Authorization", bearer("a", "ROLE_ADMIN")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/forecast/channels").header("Authorization", bearer("u", "ROLE_USER")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/forecast/channels").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
        mvc.perform(postJson("/api/forecast/models/train", Map.of("target", "REVENUE"))
                        .header("Authorization", bearer("m", "ROLE_MANAGER")))
                .andExpect(status().isForbidden());
    }

    // ----------------------------------------------------------------------------------- данные

    @Test
    @WithMockUser(roles = "ADMIN")
    void demoDataIsSeededIntoNewTables() throws Exception {
        assertThat(getJson("/api/forecast/channels")).hasSize(6);
        JsonNode sales = getJson("/api/forecast/sales?latest=1000");
        assertThat(sales).hasSize(196);
        assertThat(sales.get(0).get("weekStart").asText()).isEqualTo("2023-01-02");
        assertThat(sales.get(195).get("weekStart").asText()).isEqualTo("2026-09-28");
        assertThat(sales.get(0).get("source").asText()).isEqualTo("DEMO");
        JsonNode campaigns = getJson("/api/forecast/campaigns?size=5");
        assertThat(campaigns.get("totalElements").asInt()).isGreaterThan(200);
        assertThat(campaigns.get("content")).hasSize(5);
    }

    // ----------------------------------------------------------------------------------- безопасность

    @Test
    void anonymousAccessIsUnauthorized() throws Exception {
        mvc.perform(get("/api/forecast/channels")).andExpect(status().isUnauthorized());
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE", "horizonWeeks", 4)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void regularUserIsForbidden() throws Exception {
        mvc.perform(get("/api/forecast/channels")).andExpect(status().isForbidden());
        mvc.perform(get("/api/forecast/status")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    void managerCanManageCampaignsButNotModelsOrChannels() throws Exception {
        mvc.perform(get("/api/forecast/channels")).andExpect(status().isOk());
        mvc.perform(postJson("/api/forecast/channels", Map.of("code", "tv", "name", "ТВ", "type", "OFFLINE")))
                .andExpect(status().isForbidden());
        mvc.perform(postJson("/api/forecast/models/train", Map.of("target", "REVENUE"))).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/forecast/sales/import").file(new MockMultipartFile("file", "a.csv", "text/csv",
                "2026-10-05;1;1".getBytes(StandardCharsets.UTF_8)))).andExpect(status().isForbidden());
        long channelId = getJson("/api/forecast/channels").get(0).get("id").asLong();
        mvc.perform(postJson("/api/forecast/campaigns", campaign(channelId, "2026-11-02", "2026-11-29", 1200)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.createdBy").value("manager"));
    }

    // ----------------------------------------------------------------------------------- модели и прогноз

    @Test
    @WithMockUser(username = "boss", roles = "ADMIN")
    void trainingRegistersModelAndSendsAlignedDatasetToMlService() throws Exception {
        JsonNode model = train("REVENUE");
        assertThat(model.get("summary").get("algorithm").asText()).isEqualTo("mmm_ridge");
        assertThat(model.get("summary").get("status").asText()).isEqualTo("ACTIVE");
        assertThat(model.get("summary").get("trainedBy").asText()).isEqualTo("boss");
        assertThat(model.get("candidates")).hasSize(4);
        assertThat(model.get("channelEffects")).hasSize(6);
        assertThat(model.get("channelEffects").get(0).get("channelName").asText()).isNotBlank();
        assertThat(model.get("backtest")).hasSize(12);

        JsonNode sent = ml.trainRequests.get(0);
        assertThat(sent.get("target").asText()).isEqualTo("revenue");
        assertThat(sent.get("sales")).hasSize(196);
        assertThat(sent.get("spend")).hasSize(196);
        assertThat(sent.get("channels")).hasSize(6);
        assertThat(sent.get("fingerprint").asText()).hasSize(64);
        assertThat(sent.get("spend").get(0).get("week_start").asText()).isEqualTo("2023-01-02");
        double firstWeekSpend = 0;
        var it = sent.get("spend").get(0).get("spend").elements();
        while (it.hasNext()) {
            firstWeekSpend += it.next().asDouble();
        }
        assertThat(firstWeekSpend).isGreaterThan(0);

        JsonNode list = getJson("/api/forecast/models");
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("stale").asBoolean()).isFalse();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void predictionFollowsPlanAndIsConsistentWithComponents() throws Exception {
        train("REVENUE");
        JsonNode p = read(mvc.perform(postJson("/api/forecast/predict",
                Map.of("target", "REVENUE", "horizonWeeks", 8))).andExpect(status().isOk()).andReturn());
        assertThat(p.get("degraded").asBoolean()).isFalse();
        assertThat(p.get("originWeek").asText()).isEqualTo("2026-10-05");
        assertThat(p.get("scenarioType").asText()).isEqualTo("PLAN");
        assertThat(p.get("points")).hasSize(8);
        assertThat(p.get("history")).hasSize(26);
        assertThat(p.get("history").get(25).get("weekStart").asText()).isEqualTo("2026-09-28");
        for (JsonNode point : p.get("points")) {
            double contributions = 0;
            var contrib = point.get("contributions").elements();
            while (contrib.hasNext()) {
                contributions += contrib.next().asDouble();
            }
            assertThat(point.get("base").asDouble() + contributions).isEqualTo(point.get("predicted").asDouble(),
                    org.assertj.core.data.Offset.offset(1e-6));
            assertThat(point.get("lower").asDouble()).isLessThan(point.get("predicted").asDouble());
            assertThat(point.get("spend")).hasSize(6);
        }
        JsonNode totals = p.get("totals");
        assertThat(totals.get("previousPeriodActual").asDouble()).isGreaterThan(0);
        assertThat(totals.get("sameWeeksLastYearActual").asDouble()).isGreaterThan(0);
        assertThat(totals.get("totalSpend").asDouble()).isGreaterThan(0);
        assertThat(p.get("channels")).hasSize(6);
        assertThat(p.get("model").get("stale").asBoolean()).isFalse();

        JsonNode request = ml.forecastRequests.get(ml.forecastRequests.size() - 1);
        assertThat(request.get("start_week").asText()).isEqualTo("2026-10-05");
        assertThat(request.get("spend")).hasSize(8);                 // нет разрыва между обучением и началом прогноза
        assertThat(request.get("spend").get(0).get("week_start").asText()).isEqualTo("2026-10-05");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void scenariosChangeSpendSentToMlService() throws Exception {
        train("REVENUE");
        JsonNode plan = predict(Map.of("type", "PLAN"));
        double planSearch = plannedSpend(plan, "search");
        double planOta = plannedSpend(plan, "ota");
        assertThat(planSearch).isGreaterThan(0);
        assertThat(planOta).isGreaterThan(0);

        JsonNode none = predict(Map.of("type", "NO_MARKETING"));
        none.get("points").forEach(pt -> pt.get("spend").elements().forEachRemaining(v -> assertThat(v.asDouble()).isZero()));
        assertThat(none.get("totals").get("predicted").asDouble()).isLessThan(plan.get("totals").get("predicted").asDouble());

        JsonNode doubled = predict(Map.of("type", "CUSTOM", "multipliers", Map.of("search", 2.0)));
        assertThat(plannedSpend(doubled, "search")).isEqualTo(planSearch * 2, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(plannedSpend(doubled, "ota")).isEqualTo(planOta, org.assertj.core.data.Offset.offset(1e-6));
        JsonNode lastRequest = ml.forecastRequests.get(ml.forecastRequests.size() - 1);
        double sentSearch = 0;
        for (JsonNode row : lastRequest.get("spend")) {
            sentSearch += row.get("spend").get("search").asDouble();
        }
        assertThat(sentSearch).isEqualTo(planSearch * 2, org.assertj.core.data.Offset.offset(0.5));   // округление до копеек

        JsonNode fixed = predict(Map.of("type", "CUSTOM", "weeklySpend", Map.of("email", 500.0)));
        fixed.get("points").forEach(pt -> assertThat(pt.get("spend").get("email").asDouble()).isEqualTo(500.0));
        assertThat(fixed.get("totals").get("predicted").asDouble()).isGreaterThan(none.get("totals").get("predicted").asDouble());
    }

    private static double plannedSpend(JsonNode prediction, String code) {
        for (JsonNode c : prediction.get("channels")) {
            if (code.equals(c.get("code").asText())) {
                return c.get("plannedSpend").asDouble();
            }
        }
        throw new AssertionError("нет канала " + code);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void invalidScenariosAndHorizonsAreRejected() throws Exception {
        train("REVENUE");
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE", "horizonWeeks", 4,
                "scenario", Map.of("type", "CUSTOM", "multipliers", Map.of("ghost", 1.5)))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("ghost")));
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE", "horizonWeeks", 4,
                "scenario", Map.of("type", "CUSTOM", "multipliers", Map.of("search", 11.0)))))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE", "horizonWeeks", 0)))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE", "horizonWeeks", 53)))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "NOPE", "horizonWeeks", 4)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void predictionWithoutModelAsksToTrainIt() throws Exception {
        mvc.perform(postJson("/api/forecast/predict", Map.of("target", "BOOKINGS", "horizonWeeks", 4)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("не обучена")));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void identicalPredictionsAreServedFromCache() throws Exception {
        train("REVENUE");
        predict(Map.of("type", "PLAN"));
        int afterFirst = ml.forecastCalls.get();
        predict(Map.of("type", "PLAN"));
        assertThat(ml.forecastCalls.get()).isEqualTo(afterFirst);                 // попадание в кэш
        predict(Map.of("type", "CUSTOM", "multipliers", Map.of("social", 1.5)));
        assertThat(ml.forecastCalls.get()).isEqualTo(afterFirst + 1);             // другой сценарий — новый расчёт
    }

    // ----------------------------------------------------------------------------------- устойчивость

    @Test
    @WithMockUser(roles = "ADMIN")
    void whenAiServiceFailsForecastDegradesToFallbackAndCircuitOpens() throws Exception {
        train("REVENUE");
        ml.setMode(FakeMlServer.Mode.ERROR_500);
        JsonNode degraded = null;
        for (int weeks = 4; weeks < 10; weeks++) {              // разные горизонты — кэш не помогает
            degraded = read(mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE",
                    "horizonWeeks", weeks))).andExpect(status().isOk()).andReturn());
            assertThat(degraded.get("degraded").asBoolean()).isTrue();
            assertThat(degraded.get("points")).hasSize(weeks);
        }
        assertThat(degraded.get("degradedReason").asText()).contains("упрощённый");
        assertThat(degraded.get("points").get(0).get("contributions").isNull()).isTrue();
        assertThat(degraded.get("points").get(0).get("predicted").asDouble()).isGreaterThan(0);
        assertThat(breakers.circuitBreaker("mlService").getState()).isEqualTo(CircuitBreaker.State.OPEN);

        // предохранитель разомкнут: запросы к сервису больше не отправляются
        int callsWhileOpen = ml.forecastCalls.get();
        predict(Map.of("type", "PLAN"));
        assertThat(ml.forecastCalls.get()).isEqualTo(callsWhileOpen);

        JsonNode status = getJson("/api/forecast/status");
        assertThat(status.get("ai").get("state").asText()).isEqualTo("CIRCUIT_OPEN");
        assertThat(status.get("ai").get("circuitBreaker").asText()).isEqualTo("OPEN");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void statusReportsHealthyServiceAndData() throws Exception {
        JsonNode status = getJson("/api/forecast/status");
        assertThat(status.get("ai").get("state").asText()).isEqualTo("UP");
        assertThat(status.get("ai").get("version").asText()).isEqualTo("1.0.0");
        assertThat(status.get("data").get("salesWeeks").asInt()).isEqualTo(196);
        assertThat(status.get("data").get("channels").asInt()).isEqualTo(6);
        assertThat(status.get("models")).hasSize(2);
        assertThat(status.get("models").get(0).get("modelId").isNull()).isTrue();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void trainingFailureIsReportedAsServiceUnavailable() throws Exception {
        ml.setMode(FakeMlServer.Mode.ERROR_500);
        mvc.perform(postJson("/api/forecast/models/train", Map.of("target", "REVENUE")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("недоступен")));
        assertThat(getJson("/api/forecast/models")).isEmpty();
    }

    // ----------------------------------------------------------------------------------- оптимизация

    @Test
    @WithMockUser(roles = "ADMIN")
    void optimizationReturnsAllocationAndApplicableScenario() throws Exception {
        train("REVENUE");
        JsonNode result = read(mvc.perform(postJson("/api/forecast/optimize",
                Map.of("target", "REVENUE", "horizonWeeks", 12))).andExpect(status().isOk()).andReturn());
        assertThat(result.get("allocations")).hasSize(6);
        assertThat(result.get("suggestedWeeklySpend")).hasSize(6);
        assertThat(result.get("planBudget").asDouble()).isGreaterThan(0);
        assertThat(result.get("upliftPct").asDouble()).isGreaterThan(0);
        assertThat(result.get("allocations").get(0).get("name").asText()).isNotBlank();
        JsonNode sent = ml.optimizeRequests.get(0);
        assertThat(sent.get("total_budget").asDouble()).isEqualTo(result.get("planBudget").asDouble());
        assertThat(sent.get("spend")).hasSize(12);

        // с заданным бюджетом и ограничениями
        JsonNode limited = read(mvc.perform(postJson("/api/forecast/optimize", Map.of("target", "REVENUE",
                "horizonWeeks", 12, "totalBudget", 30000.0,
                "limits", List.of(Map.of("channelCode", "outdoor", "minShare", 0.0, "maxShare", 0.1)))))
                .andExpect(status().isOk()).andReturn());
        assertThat(limited.get("totalBudget").asDouble()).isEqualTo(30000.0);
        JsonNode constraints = ml.optimizeRequests.get(1).get("constraints");
        assertThat(constraints).hasSize(1);
        assertThat(constraints.get(0).get("max_share").asDouble()).isEqualTo(0.1);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void optimizationValidatesInputAndReportsUnavailableService() throws Exception {
        train("REVENUE");
        mvc.perform(postJson("/api/forecast/optimize", Map.of("target", "REVENUE", "horizonWeeks", 12,
                "limits", List.of(Map.of("channelCode", "ghost", "minShare", 0.0, "maxShare", 0.5)))))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/forecast/optimize", Map.of("target", "REVENUE", "horizonWeeks", 12,
                "totalBudget", -5.0))).andExpect(status().isBadRequest());
        ml.setMode(FakeMlServer.Mode.ERROR_500);
        mvc.perform(postJson("/api/forecast/optimize", Map.of("target", "REVENUE", "horizonWeeks", 12)))
                .andExpect(status().isServiceUnavailable());
    }

    // ----------------------------------------------------------------------------------- кампании и каналы

    @Test
    @WithMockUser(username = "boss", roles = "ADMIN")
    void campaignLifecycleAndValidation() throws Exception {
        long channelId = getJson("/api/forecast/channels").get(0).get("id").asLong();
        JsonNode created = read(mvc.perform(postJson("/api/forecast/campaigns",
                campaign(channelId, "2027-06-07", "2027-06-20", 1400))).andExpect(status().isCreated()).andReturn());
        long id = created.get("id").asLong();
        assertThat(created.get("days").asInt()).isEqualTo(14);
        assertThat(created.get("weeklyBudget").asDouble()).isEqualTo(700.0);
        assertThat(created.get("status").asText()).isEqualTo("PLANNED");

        JsonNode filtered = getJson("/api/forecast/campaigns?channelId=" + channelId + "&from=2027-06-01&to=2027-06-30");
        assertThat(filtered.get("totalElements").asInt()).isEqualTo(1);

        mvc.perform(put("/api/forecast/campaigns/" + id).contentType("application/json")
                        .content(json.writeValueAsString(campaign(channelId, "2027-06-07", "2027-06-13", 900))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.days").value(7)).andExpect(jsonPath("$.budget").value(900.0));

        mvc.perform(postJson("/api/forecast/campaigns", campaign(channelId, "2027-06-20", "2027-06-10", 100)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("раньше")));
        mvc.perform(postJson("/api/forecast/campaigns", campaign(999999L, "2027-06-10", "2027-06-20", 100)))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/forecast/campaigns", campaign(channelId, "2027-06-10", "2027-06-20", -1)))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/forecast/campaigns", campaign(channelId, "2025-01-01", "2027-01-01", 100)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("400")));

        mvc.perform(delete("/api/forecast/campaigns/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/forecast/campaigns/" + id)).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void channelRules() throws Exception {
        mvc.perform(postJson("/api/forecast/channels", Map.of("code", "tv", "name", "Телевидение", "type", "OFFLINE")))
                .andExpect(status().isCreated());
        mvc.perform(postJson("/api/forecast/channels", Map.of("code", "tv", "name", "Дубль", "type", "OFFLINE")))
                .andExpect(status().isConflict());
        mvc.perform(postJson("/api/forecast/channels", Map.of("code", "Bad Code", "name", "x", "type", "OFFLINE")))
                .andExpect(status().isBadRequest());

        JsonNode channels = getJson("/api/forecast/channels");
        long tvId = 0;
        long withCampaigns = 0;
        for (JsonNode c : channels) {
            if ("tv".equals(c.get("code").asText())) {
                tvId = c.get("id").asLong();
            } else if (c.get("campaignCount").asLong() > 0) {
                withCampaigns = c.get("id").asLong();
            }
        }
        mvc.perform(put("/api/forecast/channels/" + tvId).contentType("application/json").content(json.writeValueAsString(
                Map.of("code", "tv2", "name", "ТВ", "type", "OFFLINE")))).andExpect(status().isBadRequest());   // код неизменяем
        mvc.perform(delete("/api/forecast/channels/" + withCampaigns)).andExpect(status().isConflict());
        mvc.perform(delete("/api/forecast/channels/" + tvId)).andExpect(status().isNoContent());
    }

    // ----------------------------------------------------------------------------------- продажи и устаревание

    @Test
    @WithMockUser(roles = "ADMIN")
    void salesEntryImportAndDeletion() throws Exception {
        // ввод за среду приводится к понедельнику
        mvc.perform(put("/api/forecast/sales").contentType("application/json").content(json.writeValueAsString(
                        Map.of("weekStart", "2026-10-07", "bookings", 90, "revenue", 19500.5))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.weekStart").value("2026-10-05"))
                .andExpect(jsonPath("$.source").value("MANUAL"));
        String csv = "Неделя;Бронирований;Выручка\n12.10.2026;95;20 100,25\n2026-10-05;91;19800\n";
        mvc.perform(multipart("/api/forecast/sales/import").file(new MockMultipartFile("file", "s.csv", "text/csv",
                        csv.getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.created").value(1)).andExpect(jsonPath("$.updated").value(1));
        JsonNode latest = getJson("/api/forecast/sales?latest=2");
        assertThat(latest.get(1).get("weekStart").asText()).isEqualTo("2026-10-12");
        assertThat(latest.get(1).get("source").asText()).isEqualTo("IMPORT");
        assertThat(latest.get(1).get("revenue").asDouble()).isEqualTo(20100.25);

        mvc.perform(multipart("/api/forecast/sales/import").file(new MockMultipartFile("file", "bad.csv", "text/csv",
                        "2026-10-19;1;1\nmусор;1;1\n".getBytes(StandardCharsets.UTF_8)))).andExpect(status().isBadRequest());
        assertThat(getJson("/api/forecast/sales?latest=1").get(0).get("weekStart").asText()).isEqualTo("2026-10-12");   // ничего не загружено

        mvc.perform(delete("/api/forecast/sales/2026-10-12")).andExpect(status().isNoContent());
        mvc.perform(delete("/api/forecast/sales/2026-10-12")).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void newActualsMakeModelStaleShiftForecastOriginAndFeedMonitoring() throws Exception {
        long modelId = train("REVENUE").get("summary").get("id").asLong();
        JsonNode noData = getJson("/api/forecast/models/" + modelId + "/monitoring");
        assertThat(noData.get("status").asText()).isEqualTo("NO_DATA");

        for (String week : List.of("2026-10-05", "2026-10-12")) {
            mvc.perform(put("/api/forecast/sales").contentType("application/json").content(json.writeValueAsString(
                    Map.of("weekStart", week, "bookings", 90, "revenue", 20000.0)))).andExpect(status().isOk());
        }
        assertThat(getJson("/api/forecast/models").get(0).get("stale").asBoolean()).isTrue();

        JsonNode p = predict(Map.of("type", "PLAN"));
        assertThat(p.get("originWeek").asText()).isEqualTo("2026-10-19");
        assertThat(p.get("warnings").toString()).contains("переобучить");
        JsonNode request = ml.forecastRequests.get(ml.forecastRequests.size() - 1);
        assertThat(request.get("start_week").asText()).isEqualTo("2026-10-19");
        assertThat(request.get("spend").get(0).get("week_start").asText()).isEqualTo("2026-10-05");   // фактические затраты за разрыв
        assertThat(request.get("spend")).hasSize(2 + 8);

        JsonNode few = getJson("/api/forecast/models/" + modelId + "/monitoring");
        assertThat(few.get("status").asText()).isEqualTo("INSUFFICIENT");
        assertThat(few.get("points")).hasSize(2);

        for (String week : List.of("2026-10-19", "2026-10-26", "2026-11-02")) {
            mvc.perform(put("/api/forecast/sales").contentType("application/json").content(json.writeValueAsString(
                    Map.of("weekStart", week, "bookings", 90, "revenue", 20000.0)))).andExpect(status().isOk());
        }
        JsonNode monitoring = getJson("/api/forecast/models/" + modelId + "/monitoring");
        assertThat(monitoring.get("weeks").asInt()).isEqualTo(5);
        assertThat(monitoring.get("status").asText()).isEqualTo("RETRAIN");   // имитация прогнозирует ~1000 при факте 20000
        assertThat(monitoring.get("recommendation").asText()).contains("Переобучите");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void retrainingActivatesNewVersionAndRollbackIsPossible() throws Exception {
        JsonNode first = train("BOOKINGS");
        JsonNode second = train("BOOKINGS");
        JsonNode list = getJson("/api/forecast/models");
        assertThat(list).hasSize(2);
        assertThat(list.get(0).get("id").asLong()).isEqualTo(second.get("summary").get("id").asLong());
        assertThat(list.get(0).get("status").asText()).isEqualTo("ACTIVE");
        assertThat(list.get(1).get("status").asText()).isEqualTo("ARCHIVED");

        long firstId = first.get("summary").get("id").asLong();
        mvc.perform(postJson("/api/forecast/models/" + firstId + "/activate", Map.of()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.status").value("ACTIVE"));
        JsonNode after = getJson("/api/forecast/models");
        assertThat(after.findValues("status").stream().filter(s -> "ACTIVE".equals(s.asText()))).hasSize(1);
    }
    @Test
    @WithMockUser(roles = "ADMIN")
    void lossOfModelInAiRegistryIsDetectedAndPredictionDegradesGracefully() throws Exception {
        assertThat(modelService.registryLost(ForecastTarget.REVENUE)).isFalse();   // активной модели ещё нет
        train("REVENUE");
        assertThat(modelService.registryLost(ForecastTarget.REVENUE)).isFalse();   // модель есть и в БД, и в реестре ML

        ml.forgetModels();   // каталог моделей интеллектуального сервиса очищен
        assertThat(modelService.registryLost(ForecastTarget.REVENUE)).isTrue();
        assertThat(modelService.registryLost(ForecastTarget.BOOKINGS)).isFalse();  // у другого показателя модели нет

        JsonNode prediction = predict(Map.of("type", "PLAN"));
        assertThat(prediction.get("degraded").asBoolean()).isTrue();
        assertThat(prediction.get("degradedReason").asText()).contains("отсутствует в реестре").contains("Переобучите");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void unreachableAiServiceIsNotMistakenForLostModel() throws Exception {
        train("REVENUE");
        ml.setMode(FakeMlServer.Mode.ERROR_500);
        assertThatThrownBy(() -> modelService.registryLost(ForecastTarget.REVENUE))
                .isInstanceOf(AiUnavailableException.class);
    }
}
