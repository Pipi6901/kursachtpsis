package com.HotelManager.forecast.ai;

import com.HotelManager.forecast.config.ForecastProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.time.Duration;
import java.util.function.Supplier;

/**
 * Реализация шлюза поверх REST (JDK HttpClient). Аутентификация «сервис — сервис» — заголовок X-API-Key;
 * при необходимости канал защищается TLS с собственным хранилищем доверенных сертификатов.
 *
 * <p>Устойчивость: вызовы инференса (прогноз, оптимизация, проверка состояния) выполняются под
 * предохранителем и повторными попытками Resilience4j (экземпляр mlService). Учитываются только сбои
 * доступности ({@link AiUnavailableException}); ошибки данных (4xx) состояние предохранителя не меняют.
 */
@Slf4j
@Component
public class HttpForecastAiGateway implements ForecastAiGateway {

    private static final String API = "/api/v1/models";

    private final RestClient inferenceClient;
    private final RestClient trainingClient;
    private final ObjectMapper objectMapper;

    public HttpForecastAiGateway(ForecastProperties properties, RestClient.Builder builder, ObjectMapper objectMapper) {
        ForecastProperties.Ai ai = properties.ai();
        HttpClient http = buildHttpClient(ai);
        this.inferenceClient = buildClient(builder, ai, http, ai.inferenceTimeout());
        this.trainingClient = buildClient(builder, ai, http, ai.trainingTimeout());
        this.objectMapper = objectMapper;
    }

    @Override
    public AiContract.TrainResponse train(AiContract.TrainRequest request) {
        return execute("обучение модели", () -> trainingClient.post().uri(API + "/train")
                .contentType(MediaType.APPLICATION_JSON).body(request).retrieve()
                .body(AiContract.TrainResponse.class));
    }

    @Override
    @CircuitBreaker(name = "mlService")
    @Retry(name = "mlService")
    public AiContract.ForecastResponse forecast(String modelId, AiContract.ForecastRequest request) {
        return execute("прогноз", () -> inferenceClient.post().uri(API + "/{id}/forecast", modelId)
                .contentType(MediaType.APPLICATION_JSON).body(request).retrieve()
                .body(AiContract.ForecastResponse.class));
    }

    @Override
    @CircuitBreaker(name = "mlService")
    @Retry(name = "mlService")
    public AiContract.OptimizeResponse optimize(String modelId, AiContract.OptimizeRequest request) {
        return execute("оптимизация бюджета", () -> inferenceClient.post().uri(API + "/{id}/optimize", modelId)
                .contentType(MediaType.APPLICATION_JSON).body(request).retrieve()
                .body(AiContract.OptimizeResponse.class));
    }

    @Override
    @CircuitBreaker(name = "mlService")
    @Retry(name = "mlService")
    public AiContract.Health health() {
        return execute("проверка состояния", () -> inferenceClient.get().uri("/health").retrieve()
                .body(AiContract.Health.class));
    }

    /** Проверка наличия модели в реестре: вне предохранителя (как обучение), 404 — это ответ «нет», а не сбой. */
    @Override
    public boolean modelExists(String modelId) {
        try {
            execute("проверка наличия модели", () -> inferenceClient.get().uri(API + "/{id}", modelId).retrieve()
                    .toBodilessEntity());
            return true;
        } catch (AiRequestException e) {
            if (e.getStatus() == 404) {
                return false;
            }
            throw e;
        }
    }

    // ------------------------------------------------------------------------------------------

    private <T> T execute(String operation, Supplier<T> call) {
        long started = System.nanoTime();
        try {
            T result = call.get();
            if (result == null) {
                throw new AiUnavailableException("Пустой ответ интеллектуального сервиса (" + operation + ")", null);
            }
            log.debug("ML-сервис: {} выполнено за {} мс", operation, (System.nanoTime() - started) / 1_000_000);
            return result;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = extractMessage(e.getResponseBodyAsString(), status);
            if (status >= 500) {
                throw new AiUnavailableException("ML-сервис вернул ошибку " + status + " (" + operation + "): "
                        + message, e);
            }
            throw new AiRequestException(status, message);
        } catch (ResourceAccessException e) {
            throw new AiUnavailableException("Нет связи с ML-сервисом (" + operation + "): "
                    + rootMessage(e), e);
        } catch (RestClientException e) {
            throw new AiUnavailableException("Некорректный ответ ML-сервиса (" + operation + "): "
                    + rootMessage(e), e);
        }
    }

    private String extractMessage(String body, int status) {
        try {
            JsonNode node = objectMapper.readTree(body);
            JsonNode message = node.path("message");
            if (message.isTextual() && !message.asText().isBlank()) {
                return message.asText();
            }
        } catch (Exception ignored) {
            // тело не JSON — используем общий текст
        }
        return "Интеллектуальный сервис отклонил запрос (HTTP " + status + ")";
    }

    private static String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null) {
            t = t.getCause();
        }
        return t.getClass().getSimpleName() + (t.getMessage() != null ? ": " + t.getMessage() : "");
    }

    private static RestClient buildClient(RestClient.Builder builder, ForecastProperties.Ai ai, HttpClient http,
                                          Duration readTimeout) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(readTimeout);
        return builder.clone()
                .baseUrl(ai.baseUrl())
                .requestFactory(factory)
                .defaultHeader("X-API-Key", ai.apiKey())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    private static HttpClient buildHttpClient(ForecastProperties.Ai ai) {
        HttpClient.Builder builder = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(ai.connectTimeout());
        if (StringUtils.hasText(ai.trustStore())) {
            builder.sslContext(sslContext(ai));
        }
        return builder.build();
    }

    private static SSLContext sslContext(ForecastProperties.Ai ai) {
        try (InputStream in = Files.newInputStream(Path.of(ai.trustStore()))) {
            KeyStore store = KeyStore.getInstance("PKCS12");
            store.load(in, ai.trustStorePassword().toCharArray());
            TrustManagerFactory factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            factory.init(store);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, factory.getTrustManagers(), null);
            return context;
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось загрузить хранилище доверенных сертификатов: "
                    + ai.trustStore(), e);
        }
    }
}
