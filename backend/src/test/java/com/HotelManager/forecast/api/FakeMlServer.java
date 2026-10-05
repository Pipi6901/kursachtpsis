package com.HotelManager.forecast.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Имитация интеллектуального микросервиса для интеграционных тестов серверной части.
 * Следует контракту API v1: проверяет ключ доступа, отвечает в snake_case и может имитировать сбои.
 * Прогноз детерминирован: база = 1000 + 10·i, вклад канала = 0,5·затраты, прогноз = база + вклады.
 */
public final class FakeMlServer {

    public static final String API_KEY = "test-key";

    public enum Mode { OK, ERROR_500, SLOW }

    private static FakeMlServer shared;

    public static synchronized FakeMlServer shared() {
        if (shared == null) {
            shared = new FakeMlServer();
        }
        return shared;
    }

    private final HttpServer server;
    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicInteger modelSeq = new AtomicInteger();
    private volatile Mode mode = Mode.OK;

    public final AtomicInteger trainCalls = new AtomicInteger();
    public final AtomicInteger forecastCalls = new AtomicInteger();
    public final AtomicInteger optimizeCalls = new AtomicInteger();
    public final AtomicInteger healthCalls = new AtomicInteger();
    public final List<JsonNode> forecastRequests = new CopyOnWriteArrayList<>();
    public final List<JsonNode> trainRequests = new CopyOnWriteArrayList<>();
    public final List<JsonNode> optimizeRequests = new CopyOnWriteArrayList<>();

    private FakeMlServer() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        server.createContext("/", this::handle);
        server.setExecutor(Executors.newFixedThreadPool(4));
        server.start();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + port();
    }

    public void setMode(Mode mode) {
        this.mode = mode;
    }

    public void reset() {
        mode = Mode.OK;
        forecastRequests.clear();
        trainRequests.clear();
        optimizeRequests.clear();
    }

    private void handle(HttpExchange ex) throws IOException {
        try {
            String path = ex.getRequestURI().getPath();
            if ("/health".equals(path)) {
                healthCalls.incrementAndGet();
                respond(ex, 200, mapper.createObjectNode().put("status", "ok").put("version", "1.0.0")
                        .put("models_total", modelSeq.get()).put("encryption_enabled", true));
                return;
            }
            if (!API_KEY.equals(ex.getRequestHeaders().getFirst("X-API-Key"))) {
                respond(ex, 401, error("unauthorized", "Неверный или отсутствующий ключ доступа X-API-Key"));
                return;
            }
            JsonNode body = mapper.readTree(ex.getRequestBody().readAllBytes());
            if (path.endsWith("/train")) {
                trainCalls.incrementAndGet();
                trainRequests.add(body);
                if (fail(ex)) {
                    return;
                }
                respond(ex, 201, train(body));
            } else if (path.endsWith("/forecast")) {
                forecastCalls.incrementAndGet();
                forecastRequests.add(body);
                if (fail(ex)) {
                    return;
                }
                respond(ex, 200, forecast(path, body));
            } else if (path.endsWith("/optimize")) {
                optimizeCalls.incrementAndGet();
                optimizeRequests.add(body);
                if (fail(ex)) {
                    return;
                }
                respond(ex, 200, optimize(path, body));
            } else {
                respond(ex, 404, error("not_found", "нет такого маршрута"));
            }
        } catch (Exception e) {
            respond(ex, 500, error("internal", String.valueOf(e)));
        }
    }

    /** Имитация сбоев: 500 или слишком медленный ответ (превышает тайм-аут клиента). */
    private boolean fail(HttpExchange ex) throws IOException {
        if (mode == Mode.ERROR_500) {
            respond(ex, 500, error("internal", "сбой"));
            return true;
        }
        if (mode == Mode.SLOW) {
            try {
                Thread.sleep(2500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        return false;
    }

    private ObjectNode train(JsonNode req) {
        JsonNode sales = req.get("sales");
        int n = sales.size();
        String target = req.get("target").asText();
        ObjectNode out = mapper.createObjectNode();
        int seq = modelSeq.incrementAndGet();
        out.put("model_id", String.format("%s-20261005T1200%02d-%08x", target, seq % 100, seq));
        out.put("target", target);
        out.put("created_at", OffsetDateTime.now(ZoneOffset.UTC).toString());
        out.put("champion", "mmm_ridge");
        out.put("champion_label", "Модель маркетингового микса (MMM)");
        out.put("data_from", sales.get(0).get("week_start").asText());
        out.put("data_to", sales.get(n - 1).get("week_start").asText());
        out.put("n_obs", n);
        out.put("fingerprint", req.path("fingerprint").asText(null));
        out.put("interval_level", 0.8);
        out.put("cv_folds", 4);
        out.put("cv_horizon", 12);
        out.set("metrics", metrics(0.06, 0.062, 0.061, 120.0, 0.01));
        ArrayNode board = out.putArray("leaderboard");
        board.add(candidate("seasonal_naive", "Сезонная наивная модель", false, false, 0.09, null));
        board.add(candidate("holt_winters", "Хольта–Уинтерса (ETS)", false, false, 0.083, 0.085));
        board.add(candidate("mmm_ridge", "Модель маркетингового микса (MMM)", true, true, 0.06, 0.33));
        board.add(candidate("gbm", "Градиентный бустинг", true, false, 0.072, 0.2));
        ArrayNode effects = out.putArray("channel_effects");
        double share = 0.3 / Math.max(1, req.get("channels").size());
        for (JsonNode ch : req.get("channels")) {
            ObjectNode e = effects.addObject();
            e.put("code", ch.get("code").asText());
            e.put("adstock_decay", 0.4);
            e.put("saturation_scale", 400.0);
            e.put("max_effect", 20.0);
            e.put("total_spend", 50_000.0);
            e.put("mean_weekly_spend", 250.0);
            e.put("active_weeks", n);
            e.put("spend_cv", 0.5);
            e.put("contribution_total", 9_000.0);
            e.put("contribution_share", share);
            e.put("roi", 4.5);
            e.put("marginal_roi", 2.1);
            e.put("saturation_level", 0.6);
            e.put("low_variation", false);
        }
        ArrayNode backtest = out.putArray("backtest");
        for (int i = Math.max(0, n - 12); i < n; i++) {
            double actual = sales.get(i).get("value").asDouble();
            ObjectNode b = backtest.addObject();
            b.put("week_start", sales.get(i).get("week_start").asText());
            b.put("actual", actual);
            b.put("predicted", actual * 1.02);
            b.put("lower", actual * 0.92);
            b.put("upper", actual * 1.12);
        }
        out.putArray("warnings");
        return out;
    }

    private ObjectNode forecast(String path, JsonNode req) {
        LocalDate start = LocalDate.parse(req.get("start_week").asText());
        int horizon = req.get("horizon_weeks").asInt();
        JsonNode rows = req.get("spend");
        int skip = 0;
        while (skip < rows.size() && LocalDate.parse(rows.get(skip).get("week_start").asText()).isBefore(start)) {
            skip++;
        }
        ObjectNode out = mapper.createObjectNode();
        out.put("model_id", path.split("/")[4]);
        out.put("champion", "mmm_ridge");
        out.put("interval_level", 0.8);
        out.put("components_available", true);
        ArrayNode points = out.putArray("points");
        double total = 0;
        double totalBase = 0;
        ObjectNode totalContrib = mapper.createObjectNode();
        for (int i = 0; i < horizon; i++) {
            JsonNode row = rows.get(skip + i);
            double base = 1000 + 10 * i;
            double predicted = base;
            ObjectNode contrib = mapper.createObjectNode();
            var it = row.get("spend").fields();
            while (it.hasNext()) {
                var e = it.next();
                double c = 0.5 * e.getValue().asDouble();
                contrib.put(e.getKey(), c);
                totalContrib.put(e.getKey(), totalContrib.path(e.getKey()).asDouble(0) + c);
                predicted += c;
            }
            ObjectNode p = points.addObject();
            p.put("week_start", row.get("week_start").asText());
            p.put("predicted", predicted);
            p.put("lower", predicted * 0.9);
            p.put("upper", predicted * 1.1);
            p.put("base", base);
            p.set("contributions", contrib);
            total += predicted;
            totalBase += base;
        }
        ObjectNode totals = out.putObject("totals");
        totals.put("predicted", total);
        totals.put("lower", total * 0.9);
        totals.put("upper", total * 1.1);
        totals.put("base", totalBase);
        totals.set("contributions", totalContrib);
        return out;
    }

    private ObjectNode optimize(String path, JsonNode req) {
        double budget = req.get("total_budget").asDouble();
        int horizon = req.get("horizon_weeks").asInt();
        JsonNode rows = req.get("spend");
        java.util.List<String> codes = new java.util.ArrayList<>();
        rows.get(0).get("spend").fieldNames().forEachRemaining(codes::add);
        ObjectNode out = mapper.createObjectNode();
        out.put("model_id", path.split("/")[4]);
        out.put("total_budget", budget);
        out.put("spent_budget", budget);
        out.put("plan_budget", budget);
        out.put("plan_marketing_effect", 100.0);
        out.put("optimized_marketing_effect", 120.0);
        out.put("uplift_abs", 20.0);
        out.put("uplift_pct", 0.2);
        ArrayNode alloc = out.putArray("allocations");
        for (String code : codes) {
            ObjectNode a = alloc.addObject();
            double each = budget / codes.size();
            a.put("code", code);
            a.put("weekly_spend", each / horizon);
            a.put("total_spend", each);
            a.put("share", 1.0 / codes.size());
            a.put("expected_effect", 20.0);
            a.put("marginal_return", 3.0);
            a.put("plan_total_spend", each);
            a.put("plan_effect", 16.0);
        }
        out.putArray("notes");
        return out;
    }

    private ObjectNode metrics(double wape, double mape, double smape, double rmse, double bias) {
        return mapper.createObjectNode().put("wape", wape).put("mape", mape).put("smape", smape)
                .put("rmse", rmse).put("bias", bias).put("n", 48);
    }

    private ObjectNode candidate(String name, String label, boolean aware, boolean selected, double wape, Double skill) {
        ObjectNode c = mapper.createObjectNode();
        c.put("name", name).put("label", label).put("scenario_aware", aware).put("selected", selected);
        c.set("metrics", metrics(wape, wape + 0.002, wape, 100.0, 0.0));
        if (skill != null) {
            c.put("skill_vs_naive", skill);
        }
        c.putArray("fold_wape");
        return c;
    }

    private ObjectNode error(String code, String message) {
        return mapper.createObjectNode().put("error", code).put("message", message);
    }

    private void respond(HttpExchange ex, int status, JsonNode body) throws IOException {
        byte[] bytes = mapper.writeValueAsBytes(body);
        ex.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        ex.getResponseBody().write(bytes);
        ex.close();
    }
}
