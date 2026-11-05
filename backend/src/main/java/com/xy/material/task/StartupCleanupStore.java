package com.xy.material.task;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 启动清理的持久化操作：任务状态与阶段日志必须在同一个事务里更新。
 */
@Component
public class StartupCleanupStore {

    private static final int MAX_REASON_LENGTH = 500;

    private final TaskMapper taskMapper;
    private final StageLogMapper stageLogMapper;

    public StartupCleanupStore(TaskMapper taskMapper, StageLogMapper stageLogMapper) {
        this.taskMapper = taskMapper;
        this.stageLogMapper = stageLogMapper;
    }

    /**
     * 只处理 created_at 早于 cutoff 的任务，避免误杀启动后新提交的任务。
     * 先更新阶段日志，再更新任务，两步处于同一个 REQUIRES_NEW 事务。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int cleanup(String reason, LocalDateTime cutoff) {
        String message = truncate(reason);
        LocalDateTime now = LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS);
        stageLogMapper.failRunningForUnfinished(message, cutoff, now);
        return taskMapper.failUnfinished(message, cutoff, now);
    }

    private static String truncate(String reason) {
        if (reason == null || reason.isBlank()) {
            return "服务重启，任务已中断";
        }
        return reason.length() <= MAX_REASON_LENGTH ? reason : reason.substring(0, MAX_REASON_LENGTH);
    }
}
