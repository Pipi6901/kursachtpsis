package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.ai.ForecastAiGateway;
import com.HotelManager.forecast.dto.MonitoringDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Контроль качества после обучения (мониторинг дрейфа): модель прогнозирует недели, наступившие после
 * её обучения, и результат сравнивается с фактом, который она не видела. Рост ошибки относительно
 * кросс-валидации — признак того, что рынок изменился и модель пора переобучить.
 */
@Service
@RequiredArgsConstructor
public class MonitoringService {

    static final double WARN_RATIO = 1.5;
    static final double RETRAIN_RATIO = 2.5;
    static final int MIN_WEEKS = 4;
    static final double DEFAULT_BASELINE = 0.08;

    private final ForecastPlanner planner;
    private final ForecastDataService data;
    private final ForecastAiGateway gateway;

    public MonitoringDto monitor(Long modelId) {
        ForecastPlanner.Context ctx = planner.contextFor(modelId);
        Dataset history = ctx.history();
        int first = history.weeks().indexOf(ctx.dataTo().plusWeeks(1));
        if (first < 0) {
            return new MonitoringDto(modelId, "NO_DATA", "Нет новых данных", 0, null, ctx.wape(), null,
                    "После обучения модели фактические продажи ещё не внесены. Добавьте данные за новые недели, "
                            + "чтобы оценить точность на неизвестных модели неделях.", List.of());
        }
        int weeks = Math.min(history.size() - first, 52);
        LocalDate start = ctx.dataTo().plusWeeks(1);
        double[][] spend = data.spendFor(start, weeks, ctx.channelCodes());
        AiContract.ForecastResponse ai = gateway.forecast(ctx.externalId(), new AiContract.ForecastRequest(
                start, weeks, ForecastPlanner.rows(start, spend, ctx.channelCodes()), null, false));

        List<MonitoringDto.Point> points = new ArrayList<>();
        double absError = 0;
        double absActual = 0;
        for (int i = 0; i < weeks; i++) {
            double actual = history.sales()[first + i];
            double predicted = ai.points().get(i).predicted();
            points.add(new MonitoringDto.Point(ai.points().get(i).weekStart(), actual, predicted));
            absError += Math.abs(actual - predicted);
            absActual += Math.abs(actual);
        }
        double wape = absActual > 0 ? absError / absActual : 0;
        double baseline = ctx.wape() != null && ctx.wape() > 0 ? ctx.wape() : DEFAULT_BASELINE;
        double ratio = wape / baseline;
        String status;
        String title;
        String recommendation;
        if (weeks < MIN_WEEKS) {
            status = "INSUFFICIENT";
            title = "Мало данных для оценки";
            recommendation = "Для надёжной оценки нужно не менее " + MIN_WEEKS + " новых недель, сейчас — " + weeks + ".";
        } else if (ratio <= WARN_RATIO) {
            status = "OK";
            title = "Точность в норме";
            recommendation = "Ошибка на новых неделях сопоставима с оценкой при обучении. Переобучение не требуется.";
        } else if (ratio <= RETRAIN_RATIO) {
            status = "WARN";
            title = "Точность снизилась";
            recommendation = "Ошибка на новых неделях заметно выше, чем при обучении. Рекомендуется переобучить модель "
                    + "на актуальных данных.";
        } else {
            status = "RETRAIN";
            title = "Требуется переобучение";
            recommendation = "Ошибка на новых неделях более чем вдвое превышает ожидаемую — вероятно, изменились "
                    + "условия рынка. Переобучите модель.";
        }
        return new MonitoringDto(modelId, status, title, weeks, wape, baseline, ratio, recommendation, points);
    }
}
