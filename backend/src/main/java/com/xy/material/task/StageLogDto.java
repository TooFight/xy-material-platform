package com.xy.material.task;

import java.time.Instant;

/**
 * TaskDTO 中的阶段执行记录，见 docs/api.md §5.1。
 */
public record StageLogDto(
        TaskStage stage,
        StageLogStatus status,
        Instant startedAt,
        Instant finishedAt,
        String message
) {
}
