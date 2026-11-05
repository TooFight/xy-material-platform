package com.xy.material.task;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 任务状态写入。每个方法使用独立事务，保证阶段开始/结束分别落库，
 * 不使用包住整条流水线或 sleep 的大事务。
 */
@Component
public class TaskStore {

    private static final int MAX_REASON_LENGTH = 500;

    private final TaskMapper taskMapper;

    public TaskStore(TaskMapper taskMapper) {
        this.taskMapper = taskMapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean enterStage(long taskId, TaskStage stage) {
        return taskMapper.enterStage(taskId, stage, now()) > 0;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean fail(long taskId, TaskStage stage, String reason) {
        return taskMapper.fail(taskId, stage, truncate(reason), now()) > 0;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean succeed(long taskId, String resultUrl) {
        return taskMapper.succeed(taskId, resultUrl, now()) > 0;
    }

    private static LocalDateTime now() {
        return LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS);
    }

    private static String truncate(String reason) {
        if (reason == null || reason.isBlank()) {
            return "任务执行失败";
        }
        return reason.length() <= MAX_REASON_LENGTH ? reason : reason.substring(0, MAX_REASON_LENGTH);
    }
}
