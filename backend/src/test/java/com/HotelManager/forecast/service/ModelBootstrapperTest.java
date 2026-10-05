package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiUnavailableException;
import com.HotelManager.forecast.entity.ForecastModel;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.exception.ForecastException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.TaskScheduler;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ModelBootstrapperTest {

    private ForecastModelService models;
    private ModelBootstrapper bootstrapper;

    @BeforeEach
    void setUp() {
        models = mock(ForecastModelService.class);
        bootstrapper = new ModelBootstrapper(models, null, mock(TaskScheduler.class));
    }

    private void active(ForecastTarget target, boolean present) {
        when(models.activeModel(target)).thenReturn(present ? Optional.of(new ForecastModel()) : Optional.empty());
    }

    @Test
    void trainsTargetsThatHaveNoActiveModel() {
        active(ForecastTarget.REVENUE, false);
        active(ForecastTarget.BOOKINGS, false);

        assertThat(bootstrapper.attempt()).isTrue();

        verify(models).train(ForecastTarget.REVENUE, "system");
        verify(models).train(ForecastTarget.BOOKINGS, "system");
    }

    @Test
    void leavesHealthyModelsAlone() {
        for (ForecastTarget target : ForecastTarget.values()) {
            active(target, true);
            when(models.registryLost(target)).thenReturn(false);
        }

        assertThat(bootstrapper.attempt()).isTrue();

        verify(models, never()).train(any(), any());
    }

    @Test
    void retrainsModelThatIsMissingFromAiRegistry() {
        active(ForecastTarget.REVENUE, true);
        active(ForecastTarget.BOOKINGS, true);
        when(models.registryLost(ForecastTarget.REVENUE)).thenReturn(true);
        when(models.registryLost(ForecastTarget.BOOKINGS)).thenReturn(false);

        assertThat(bootstrapper.attempt()).isTrue();

        verify(models).train(ForecastTarget.REVENUE, "system");
        verify(models, never()).train(eq(ForecastTarget.BOOKINGS), any());
    }

    @Test
    void keepsRetryingWhileAiServiceIsUnreachable() {
        for (ForecastTarget target : ForecastTarget.values()) {
            active(target, true);
            when(models.registryLost(target)).thenThrow(new AiUnavailableException("нет связи", null));
        }

        assertThat(bootstrapper.attempt()).isFalse();   // повторить позже

        verify(models, never()).train(any(), any());
    }

    @Test
    void stopsWhenTrainingIsImpossibleBecauseOfData() {
        active(ForecastTarget.REVENUE, false);
        active(ForecastTarget.BOOKINGS, false);
        when(models.train(any(), any())).thenThrow(ForecastException.badRequest("Недостаточно данных"));

        assertThat(bootstrapper.attempt()).isTrue();
    }

    @Test
    void retriesWhenAnotherTrainingIsRunning() {
        active(ForecastTarget.REVENUE, false);
        active(ForecastTarget.BOOKINGS, false);
        when(models.train(any(), any())).thenThrow(ForecastException.conflict("Обучение уже выполняется"));

        assertThat(bootstrapper.attempt()).isFalse();
    }
}
