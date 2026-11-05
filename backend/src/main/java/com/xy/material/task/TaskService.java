package com.xy.material.task;

import com.xy.material.asset.Asset;
import com.xy.material.asset.AssetService;
import com.xy.material.asset.AssetStorage;
import com.xy.material.common.ApiException;
import com.xy.material.common.ErrorCodes;
import com.xy.material.files.FileUrlSigner;
import com.xy.material.task.simulation.SimulationConfig;
import com.xy.material.task.simulation.SimulationSnapshot;
import com.xy.material.template.TemplateDetailDto;
import com.xy.material.template.TemplateService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

    private final TaskMapper taskMapper;
    private final TaskAssetMapper taskAssetMapper;
    private final TemplateService templateService;
    private final AssetService assetService;
    private final AssetStorage assetStorage;
    private final SimulationConfig simulationConfig;
    private final ApplicationEventPublisher eventPublisher;
    private final FileUrlSigner fileUrlSigner;

    public TaskService(TaskMapper taskMapper,
                       TaskAssetMapper taskAssetMapper,
                       TemplateService templateService,
                       AssetService assetService,
                       AssetStorage assetStorage,
                       SimulationConfig simulationConfig,
                       ApplicationEventPublisher eventPublisher,
                       FileUrlSigner fileUrlSigner) {
        this.taskMapper = taskMapper;
        this.taskAssetMapper = taskAssetMapper;
        this.templateService = templateService;
        this.assetService = assetService;
        this.assetStorage = assetStorage;
        this.simulationConfig = simulationConfig;
        this.eventPublisher = eventPublisher;
        this.fileUrlSigner = fileUrlSigner;
    }

    /**
     * 短事务：校验、写 tasks + task_assets、快照模拟配置。
     * 事务提交后由 TaskDispatchListener 投递到线程池，不在这里等待执行。
     */
    @Transactional
    public TaskDto submit(long userId, TaskCreateRequest request) {
        if (request == null) {
            throw ApiException.validation("请求体不能为空");
        }
        String templateId = request.templateId();
        if (templateId == null || templateId.isBlank()) {
            throw ApiException.validation("templateId 不能为空");
        }

        TemplateDetailDto template = templateService.getTemplate(templateId.trim());
        List<Long> assetIds = validateAssetIds(request.assetIds(), template.requiredImageCount());

        List<Asset> ownedAssets = assetService.findOwnedAssets(userId, assetIds);
        if (ownedAssets.size() != assetIds.size()) {
            throw ApiException.validation("素材无效或不属于当前用户");
        }
        Map<Long, Asset> assetsById = ownedAssets.stream()
                .collect(Collectors.toMap(Asset::getId, Function.identity()));
        for (Long assetId : assetIds) {
            Asset asset = assetsById.get(assetId);
            if (asset == null || !template.id().equals(asset.getTemplateId())) {
                throw ApiException.validation("素材无效或不属于当前用户");
            }
            if (!assetStorage.exists(asset.getStorageKey())) {
                throw ApiException.validation("素材文件不存在，请重新上传");
            }
        }

        SimulationSnapshot simulation = simulationConfig.snapshot();
        LocalDateTime now = LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS);

        TaskRow task = new TaskRow();
        task.setUserId(userId);
        task.setTemplateId(template.id());
        task.setStatus(TaskStatus.PENDING);
        task.setSimFailStage(simulation.failStage());
        task.setSimStageDelayMs(simulation.stageDelayMs());
        task.setCreatedAt(now);
        task.setUpdatedAt(now);

        int inserted = taskMapper.insert(task);
        if (inserted != 1 || task.getId() == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR, "任务创建失败");
        }
        for (int slot = 0; slot < assetIds.size(); slot++) {
            taskAssetMapper.insert(task.getId(), slot, assetIds.get(slot));
        }

        eventPublisher.publishEvent(new TaskAcceptedEvent(task.getId()));

        List<Asset> orderedAssets = assetIds.stream().map(assetsById::get).toList();
        return TaskDto.fromPending(task, template, orderedAssets, fileUrlSigner);
    }

    private static List<Long> validateAssetIds(List<Long> assetIds, int requiredImageCount) {
        if (assetIds == null || assetIds.isEmpty()) {
            throw ApiException.validation("assetIds 不能为空");
        }
        for (Long assetId : assetIds) {
            if (assetId == null || assetId <= 0) {
                throw ApiException.validation("assetIds 必须是正整数");
            }
        }
        if (new HashSet<>(assetIds).size() != assetIds.size()) {
            throw ApiException.validation("assetIds 不能重复");
        }
        if (assetIds.size() != requiredImageCount) {
            throw ApiException.validation(
                    "需要上传 " + requiredImageCount + " 张图片，当前为 " + assetIds.size() + " 张");
        }
        return assetIds;
    }
}
