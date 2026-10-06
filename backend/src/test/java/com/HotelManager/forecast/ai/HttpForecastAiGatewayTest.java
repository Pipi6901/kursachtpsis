package com.HotelManager.forecast.ai;

import com.HotelManager.forecast.api.FakeMlServer;
import com.HotelManager.forecast.config.ForecastProperties;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.web.client.RestClient;

import java.net.ServerSocket;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Проверка транспортного слоя шлюза на настоящем HTTP-сервере: контракт, ключ, сбои, тайм-ауты. */
class HttpForecastAiGatewayTest {

    private final FakeMlServer server = FakeMlServer.shared();

    @AfterEach
    void reset() {
        server.reset();
    }

    private HttpForecastAiGateway gateway(String baseUrl, String apiKey, Duration inference) {
        JsonMapper mapper = JsonMapper.builder().disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS).build();
        RestClient.Builder builder = RestClient.builder()
                .messageConverters(c -> {
                    c.clear();
                    c.add(new JacksonJsonHttpMessageConverter(mapper));
                });
        ForecastProperties props = new ForecastProperties(
                new ForecastProperties.Ai(baseUrl, apiKey, Duration.ofMillis(500), inference, Duration.ofSeconds(10), "", "changeit"),
                new ForecastProperties.DemoData(false), new ForecastProperties.Bootstrap(false),
                new ForecastProperties.Retrain(false, "0 0 3 * * MON"),
                new ForecastProperties.Cache(Duration.ofMinutes(1), 10));
        return new HttpForecastAiGateway(props, builder, mapper);
    }

    private static AiContract.ForecastRequest forecastRequest() {
        LocalDate start = LocalDate.of(2026, 10, 5);
        return new AiContract.ForecastRequest(start, 2, List.of(
                new AiContract.SpendRow(start, Map.of("search", 100.0, "social", 50.0)),
                new AiContract.SpendRow(start.plusWeeks(1), Map.of("search", 120.0, "social", 0.0))), null, true);
    }

    @Test
    void sendsSnakeCaseContractWithApiKeyAndMapsResponse() {
        AiContract.ForecastResponse response = gateway(server.baseUrl(), FakeMlServer.API_KEY, Duration.ofSeconds(2))
                .forecast("revenue-20260101T000000-0123abcd", forecastRequest());

        JsonNode sent = server.forecastRequests.get(0);
        assertThat(sent.get("start_week").asText()).isEqualTo("2026-10-05");      // дата — строка ISO, не массив
        assertThat(sent.get("horizon_weeks").asInt()).isEqualTo(2);
        assertThat(sent.get("include_components").asBoolean()).isTrue();
        assertThat(sent.has("interval_level")).isFalse();                         // null-поля не отправляются
        assertThat(sent.get("spend").get(1).get("week_start").asText()).isEqualTo("2026-10-12");

        assertThat(response.componentsAvailable()).isTrue();
        assertThat(response.points()).hasSize(2);
        assertThat(response.points().get(0).weekStart()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(response.points().get(0).predicted()).isEqualTo(1000 + 0.5 * 150);
        assertThat(response.points().get(0).contributions()).containsEntry("search", 50.0);
        assertThat(response.totals().predicted()).isEqualTo(response.points().stream()
                .mapToDouble(AiContract.ForecastPoint::predicted).sum());
    }

    @Test
    void wrongApiKeyIsReportedAsRequestErrorNotUnavailability() {
        HttpForecastAiGateway gateway = gateway(server.baseUrl(), "wrong-key", Duration.ofSeconds(2));
        assertThatThrownBy(() -> gateway.forecast("m", forecastRequest()))
                .isInstanceOfSatisfying(AiRequestException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(401);
                    assertThat(e.getMessage()).contains("ключ");
                });
    }

    @Test
    void serverErrorMeansUnavailable() {
        server.setMode(FakeMlServer.Mode.ERROR_500);
        assertThatThrownBy(() -> gateway(server.baseUrl(), FakeMlServer.API_KEY, Duration.ofSeconds(2))
                .forecast("m", forecastRequest())).isInstanceOf(AiUnavailableException.class);
    }

    @Test
    void connectionRefusedMeansUnavailable() throws Exception {
        int freePort;
        try (ServerSocket socket = new ServerSocket(0)) {
            freePort = socket.getLocalPort();
        }
        assertThatThrownBy(() -> gateway("http://127.0.0.1:" + freePort, FakeMlServer.API_KEY, Duration.ofSeconds(1)).health())
                .isInstanceOf(AiUnavailableException.class).hasMessageContaining("Нет связи");
    }

    @Test
    void slowResponseTriggersInferenceTimeout() {
        server.setMode(FakeMlServer.Mode.SLOW);
        long started = System.currentTimeMillis();
        assertThatThrownBy(() -> gateway(server.baseUrl(), FakeMlServer.API_KEY, Duration.ofMillis(800))
                .forecast("m", forecastRequest())).isInstanceOf(AiUnavailableException.class);
        assertThat(System.currentTimeMillis() - started).isLessThan(2400);        // ждали не дольше тайм-аута
    }

    @Test
    void healthIsMapped() {
        AiContract.Health health = gateway(server.baseUrl(), FakeMlServer.API_KEY, Duration.ofSeconds(2)).health();
        assertThat(health.status()).isEqualTo("ok");
        assertThat(health.version()).isEqualTo("1.0.0");
        assertThat(health.encryptionEnabled()).isTrue();
    }

    @Test
    void modelLookupDistinguishesMissingModelFromUnavailableService() {
        HttpForecastAiGateway gateway = gateway(server.baseUrl(), FakeMlServer.API_KEY, Duration.ofSeconds(2));
        server.forgetModels();
        assertThat(gateway.modelExists("revenue-20260101T000000-0123abcd")).isFalse();      // 404 — модели нет

        server.setMode(FakeMlServer.Mode.ERROR_500);
        assertThatThrownBy(() -> gateway.modelExists("revenue-20260101T000000-0123abcd"))   // 500 — сервис недоступен
                .isInstanceOf(AiUnavailableException.class);
        server.setMode(FakeMlServer.Mode.OK);

        assertThatThrownBy(() -> gateway(server.baseUrl(), "wrong-key", Duration.ofSeconds(2)).modelExists("m"))
                .isInstanceOfSatisfying(AiRequestException.class, e -> assertThat(e.getStatus()).isEqualTo(401));
    }
}
