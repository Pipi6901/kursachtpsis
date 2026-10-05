package com.HotelManager.forecast.service;

import com.HotelManager.forecast.ai.AiContract;
import com.HotelManager.forecast.ai.ForecastAiGateway;
import com.HotelManager.forecast.dto.ModelDetailsDto;
import com.HotelManager.forecast.dto.ModelSummaryDto;
import com.HotelManager.forecast.entity.ForecastModel;
import com.HotelManager.forecast.entity.ForecastModelBacktestPoint;
import com.HotelManager.forecast.entity.ForecastModelCandidate;
import com.HotelManager.forecast.entity.ForecastModelChannelEffect;
import com.HotelManager.forecast.entity.ForecastTarget;
import com.HotelManager.forecast.entity.MarketingChannel;
import com.HotelManager.forecast.entity.ModelStatus;
import com.HotelManager.forecast.exception.ForecastException;
import com.HotelManager.forecast.repo.ForecastModelRepository;
import com.HotelManager.forecast.repo.MarketingChannelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Реестр моделей на стороне сервера и жизненный цикл обучения: сборка набора данных → обучение у
 * интеллектуального сервиса → сохранение метаданных → переключение активной модели.
 * Одновременно выполняется только одно обучение.
 */
@Slf4j
@Service
public class ForecastModelService {

    /** Сколько архивных моделей хранить по каждому показателю. */
    static final int KEEP_ARCHIVED = 10;

    private final ForecastModelRepository models;
    private final MarketingChannelRepository channels;
    private final ForecastDataService data;
    private final ForecastAiGateway gateway;
    private final TransactionTemplate tx;
    private final ReentrantLock trainLock = new ReentrantLock();

    public ForecastModelService(ForecastModelRepository models, MarketingChannelRepository channels,
                                ForecastDataService data, ForecastAiGateway gateway,
                                PlatformTransactionManager transactionManager) {
        this.models = models;
        this.channels = channels;
        this.data = data;
        this.gateway = gateway;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** Обучает модели по текущим данным и делает результат активной моделью показателя. */
    public ModelDetailsDto train(ForecastTarget target, String username) {
        if (!trainLock.tryLock()) {
            throw ForecastException.conflict("Обучение уже выполняется. Дождитесь его завершения.");
        }
        try {
            Dataset dataset = data.trainingDataset(target);
            AiContract.TrainRequest request = buildRequest(target, dataset);
            log.info("Обучение модели «{}»: {} недель, {} каналов", target, dataset.size(), dataset.channelCodes().size());
            AiContract.TrainResponse response = gateway.train(request);   // вне транзакции БД: операция долгая
            ModelDetailsDto details = tx.execute(status -> persist(response, target, username, dataset));
            log.info("Модель {} обучена: чемпион {}, WAPE {}", response.modelId(), response.champion(),
                    response.metrics().wape());
            return details;
        } finally {
            trainLock.unlock();
        }
    }

    private AiContract.TrainRequest buildRequest(ForecastTarget target, Dataset ds) {
        List<AiContract.Channel> aiChannels = new ArrayList<>();
        Map<String, String> names = new java.util.HashMap<>();
        for (MarketingChannel ch : data.channelsByCodes(ds.channelCodes())) {
            names.put(ch.getCode(), ch.getName());
        }
        for (String code : ds.channelCodes()) {
            aiChannels.add(new AiContract.Channel(code, names.getOrDefault(code, code)));
        }
        List<AiContract.SalesPoint> sales = new ArrayList<>(ds.size());
        for (int i = 0; i < ds.size(); i++) {
            sales.add(new AiContract.SalesPoint(ds.weeks().get(i), ds.sales()[i]));
        }
        List<AiContract.SpendRow> spend = ForecastPlanner.rows(ds.firstWeek(), ds.spend(), ds.channelCodes());
        return new AiContract.TrainRequest(target.getMlLabel(), aiChannels, sales, spend, null,
                DatasetAssembler.fingerprint(ds));
    }

    private ModelDetailsDto persist(AiContract.TrainResponse r, ForecastTarget target, String username, Dataset ds) {
        ForecastModel model = new ForecastModel();
        model.setExternalId(r.modelId());
        model.setTarget(target);
        model.setStatus(ModelStatus.ACTIVE);
        model.setAlgorithm(r.champion());
        model.setAlgorithmLabel(r.championLabel());
        model.setTrainedAt(r.createdAt() != null
                ? LocalDateTime.ofInstant(r.createdAt().toInstant(), ZoneId.systemDefault()) : LocalDateTime.now());
        model.setTrainedBy(username);
        model.setDataFrom(r.dataFrom());
        model.setDataTo(r.dataTo());
        model.setObservations(r.nObs());
        model.setWape(r.metrics().wape());
        model.setMape(r.metrics().mape());
        model.setSmape(r.metrics().smape());
        model.setRmse(r.metrics().rmse());
        model.setBias(r.metrics().bias());
        model.setCvFolds(r.cvFolds());
        model.setCvHorizon(r.cvHorizon());
        model.setIntervalLevel(r.intervalLevel());
        model.setDataFingerprint(r.fingerprint() != null ? r.fingerprint() : DatasetAssembler.fingerprint(ds));
        if (r.warnings() != null) {
            model.getWarnings().addAll(r.warnings().stream().map(w -> w.length() > 500 ? w.substring(0, 500) : w).toList());
        }
        for (AiContract.Candidate c : r.leaderboard()) {
            ForecastModelCandidate cand = new ForecastModelCandidate();
            cand.setModel(model);
            cand.setAlgorithm(c.name());
            cand.setLabel(c.label());
            cand.setScenarioAware(c.scenarioAware());
            cand.setSelected(c.selected());
            if (c.metrics() != null) {
                cand.setWape(c.metrics().wape());
                cand.setMape(c.metrics().mape());
                cand.setRmse(c.metrics().rmse());
            }
            cand.setSkillVsNaive(c.skillVsNaive());
            cand.setSkippedReason(c.skippedReason() != null && c.skippedReason().length() > 300
                    ? c.skippedReason().substring(0, 300) : c.skippedReason());
            model.getCandidates().add(cand);
        }
        for (AiContract.ChannelEffect e : r.channelEffects()) {
            Optional<MarketingChannel> channel = channels.findByCode(e.code());
            if (channel.isEmpty()) {
                continue;
            }
            ForecastModelChannelEffect eff = new ForecastModelChannelEffect();
            eff.setModel(model);
            eff.setChannel(channel.get());
            eff.setAdstockDecay(e.adstockDecay());
            eff.setSaturationScale(e.saturationScale());
            eff.setMaxEffect(e.maxEffect());
            eff.setTotalSpend(e.totalSpend());
            eff.setMeanWeeklySpend(e.meanWeeklySpend());
            eff.setActiveWeeks(e.activeWeeks());
            eff.setSpendCv(e.spendCv());
            eff.setContributionTotal(e.contributionTotal());
            eff.setContributionShare(e.contributionShare());
            eff.setRoi(e.roi());
            eff.setMarginalRoi(e.marginalRoi());
            eff.setSaturationLevel(e.saturationLevel());
            eff.setLowVariation(e.lowVariation());
            model.getEffects().add(eff);
        }
        for (AiContract.BacktestPoint b : r.backtest()) {
            ForecastModelBacktestPoint p = new ForecastModelBacktestPoint();
            p.setModel(model);
            p.setWeekStart(b.weekStart());
            p.setActual(b.actual());
            p.setPredicted(b.predicted());
            p.setLower(b.lower());
            p.setUpper(b.upper());
            model.getBacktest().add(p);
        }
        for (ForecastModel previous : models.findByTargetAndStatus(target, ModelStatus.ACTIVE)) {
            previous.setStatus(ModelStatus.ARCHIVED);
        }
        models.saveAndFlush(model);
        pruneArchive(target);
        return details(model, currentFingerprints());
    }

    private void pruneArchive(ForecastTarget target) {
        List<ForecastModel> archived = models.findByTargetOrderByTrainedAtDesc(target).stream()
                .filter(m -> m.getStatus() == ModelStatus.ARCHIVED).toList();
        if (archived.size() > KEEP_ARCHIVED) {
            models.deleteAll(archived.subList(KEEP_ARCHIVED, archived.size()));
        }
    }

    @Transactional(readOnly = true)
    public List<ModelSummaryDto> list() {
        Map<ForecastTarget, String> fingerprints = currentFingerprints();
        return models.findAllByOrderByTrainedAtDesc().stream().map(m -> summary(m, fingerprints)).toList();
    }

    @Transactional(readOnly = true)
    public ModelDetailsDto get(Long id) {
        ForecastModel model = models.findById(id).orElseThrow(() -> ForecastException.notFound("Модель не найдена."));
        return details(model, currentFingerprints());
    }

    /** Делает архивную модель активной (откат на предыдущую версию). */
    @Transactional
    public ModelDetailsDto activate(Long id) {
        ForecastModel model = models.findById(id).orElseThrow(() -> ForecastException.notFound("Модель не найдена."));
        for (ForecastModel other : models.findByTargetAndStatus(model.getTarget(), ModelStatus.ACTIVE)) {
            other.setStatus(ModelStatus.ARCHIVED);
        }
        model.setStatus(ModelStatus.ACTIVE);
        models.saveAndFlush(model);
        return details(model, currentFingerprints());
    }

    @Transactional(readOnly = true)
    public Optional<ForecastModel> activeModel(ForecastTarget target) {
        return models.findFirstByTargetAndStatusOrderByTrainedAtDesc(target, ModelStatus.ACTIVE);
    }

    /** Нужно ли переобучить показатель: модели нет или данные изменились после обучения. */
    @Transactional(readOnly = true)
    public boolean needsTraining(ForecastTarget target) {
        Optional<ForecastModel> active = activeModel(target);
        if (active.isEmpty()) {
            return true;
        }
        try {
            return !DatasetAssembler.fingerprint(data.trainingDataset(target)).equals(active.get().getDataFingerprint());
        } catch (ForecastException e) {
            return false;   // данных недостаточно — обучать нечего
        }
    }

    /** Отпечатки текущих данных по показателям (null — данных недостаточно для обучения). */
    private Map<ForecastTarget, String> currentFingerprints() {
        Map<ForecastTarget, String> result = new EnumMap<>(ForecastTarget.class);
        for (ForecastTarget target : ForecastTarget.values()) {
            try {
                result.put(target, DatasetAssembler.fingerprint(data.trainingDataset(target)));
            } catch (ForecastException e) {
                // нет данных — устареванию неоткуда взяться
            }
        }
        return result;
    }

    private ModelSummaryDto summary(ForecastModel m, Map<ForecastTarget, String> fingerprints) {
        String current = fingerprints.get(m.getTarget());
        boolean stale = current != null && !current.equals(m.getDataFingerprint());
        return new ModelSummaryDto(m.getId(), m.getExternalId(), m.getTarget().name(), m.getTarget().getTitle(),
                m.getStatus().name(), m.getAlgorithm(), m.getAlgorithmLabel(), m.getTrainedAt(), m.getTrainedBy(),
                m.getDataFrom(), m.getDataTo(), m.getObservations(), m.getWape(), m.getMape(), m.getRmse(), stale);
    }

    private ModelDetailsDto details(ForecastModel m, Map<ForecastTarget, String> fingerprints) {
        return new ModelDetailsDto(summary(m, fingerprints), m.getCvFolds(), m.getCvHorizon(), m.getIntervalLevel(),
                m.getSmape(), m.getBias(),
                m.getCandidates().stream().map(c -> new ModelDetailsDto.Candidate(c.getAlgorithm(), c.getLabel(),
                        c.isScenarioAware(), c.isSelected(), c.getWape(), c.getMape(), c.getRmse(),
                        c.getSkillVsNaive(), c.getSkippedReason())).toList(),
                m.getEffects().stream().map(e -> new ModelDetailsDto.ChannelEffect(e.getChannel().getCode(),
                        e.getChannel().getName(), e.getAdstockDecay(), e.getSaturationScale(), e.getMaxEffect(),
                        e.getTotalSpend(), e.getMeanWeeklySpend(), e.getActiveWeeks(), e.getSpendCv(),
                        e.getContributionTotal(), e.getContributionShare(), e.getRoi(), e.getMarginalRoi(),
                        e.getSaturationLevel(), e.isLowVariation())).toList(),
                m.getBacktest().stream().map(b -> new ModelDetailsDto.BacktestPoint(b.getWeekStart(), b.getActual(),
                        b.getPredicted(), b.getLower(), b.getUpper())).toList(),
                List.copyOf(m.getWarnings()));
    }
}
