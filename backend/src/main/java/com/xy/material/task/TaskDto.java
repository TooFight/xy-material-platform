package com.xy.material.task;

import com.xy.material.asset.Asset;
import com.xy.material.template.TemplateDetailDto;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * 任务接口响应，字段见 docs/api.md §5.1。
 * 列表接口传入 stages = null，表示列表项不包含阶段明细。
 */
public record TaskDto(
        long id,
        String templateId,
        String templateTitle,
        String templateCoverUrl,
        TaskStatus status,
        TaskStage stage,
        TaskStage failedStage,
        String failureReason,
        String resultUrl,
        List<TaskAssetDto> assets,
        List<StageLogDto> stages,
        Instant createdAt,
        Instant startedAt,
        Instant finishedAt,
        Instant updatedAt
) {

    public static TaskDto fromPending(TaskRow task, TemplateDetailDto template, List<Asset> assets) {
        List<TaskAssetDto> assetDtos = new ArrayList<>(assets.size());
        for (int slot = 0; slot < assets.size(); slot++) {
            Asset asset = assets.get(slot);
            assetDtos.add(new TaskAssetDto(asset.getId(), slot, asset.getUrl()));
        }
        Instant createdAt = toInstant(task.getCreatedAt());
        return new TaskDto(
                task.getId(),
                task.getTemplateId(),
                template.title(),
                template.coverUrl(),
                TaskStatus.PENDING,
                null,
                null,
                null,
                null,
                assetDtos,
                List.of(),
                createdAt,
                null,
                null,
                createdAt
        );
    }

    public static TaskDto from(TaskRow task, List<TaskAssetRow> assetRows, List<StageLogRow> stageRows) {
        List<TaskAssetDto> assets = assetRows.stream()
                .map(row -> new TaskAssetDto(row.getAssetId(), row.getSlotIndex(), "/files/" + row.getStorageKey()))
                .toList();
        List<StageLogDto> stages = stageRows == null ? null : stageRows.stream()
                .map(row -> new StageLogDto(
                        row.getStage(),
                        row.getStatus(),
                        toInstant(row.getStartedAt()),
                        toInstant(row.getFinishedAt()),
                        row.getMessage()))
                .toList();
        return new TaskDto(
                task.getId(),
                task.getTemplateId(),
                task.getTemplateTitle(),
                task.getTemplateCoverUrl(),
                task.getStatus(),
                task.getStage(),
                task.getFailedStage(),
                task.getFailureReason(),
                task.getResultUrl(),
                assets,
                stages,
                toInstant(task.getCreatedAt()),
                toInstant(task.getStartedAt()),
                toInstant(task.getFinishedAt()),
                toInstant(task.getUpdatedAt())
        );
    }

    private static Instant toInstant(LocalDateTime time) {
        return time == null ? null : time.toInstant(ZoneOffset.UTC);
    }
}
