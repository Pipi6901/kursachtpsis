package com.HotelManager.forecast.api;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Общая основа интеграционных тестов: полный контекст приложения на встраиваемой H2 (основная БД не
 * затрагивается), имитация интеллектуального сервиса на реальном HTTP-порту, откат БД после каждого теста.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
abstract class ForecastIntegrationTestBase {

    @DynamicPropertySource
    static void aiProperties(DynamicPropertyRegistry registry) {
        registry.add("forecast.ai.base-url", () -> FakeMlServer.shared().baseUrl());
    }

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;
    @Autowired
    protected CircuitBreakerRegistry breakers;

    protected final FakeMlServer ml = FakeMlServer.shared();

    @BeforeEach
    void resetAiState() {
        ml.reset();
        breakers.circuitBreaker("mlService").reset();
    }

    protected MockHttpServletRequestBuilder postJson(String url, Object body) throws Exception {
        return post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected JsonNode read(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    protected JsonNode getJson(String url) throws Exception {
        return read(mvc.perform(get(url)).andReturn());
    }

    /** Обучает модель показателя через API и возвращает описание модели. */
    protected JsonNode train(String target) throws Exception {
        return read(mvc.perform(postJson("/api/forecast/models/train", Map.of("target", target)))
                .andReturn());
    }

    /** Прогноз на 8 недель по выручке с заданным сценарием. */
    protected JsonNode predict(Map<String, Object> scenario) throws Exception {
        return read(mvc.perform(postJson("/api/forecast/predict", Map.of("target", "REVENUE", "horizonWeeks", 8,
                "scenario", scenario))).andReturn());
    }

    protected static Map<String, Object> campaign(long channelId, String from, String to, double budget) {
        return Map.of("channelId", channelId, "name", "Тестовая кампания", "startDate", from, "endDate", to,
                "budget", budget);
    }
}
