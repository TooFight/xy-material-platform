package com.xy.material.task;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 阶段日志写入，每次开始/成功/失败都是独立小事务。
 */
@Component
public class StageLogStore {

    private static final int MAX_MESSAGE_LENGTH = 500;

    private final StageLogMapper stageLogMapper;

    public StageLogStore(StageLogMapper stageLogMapper) {
        this.stageLogMapper = stageLogMapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void start(long taskId, TaskStage stage) {
        stageLogMapper.start(taskId, stage, now());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean succeed(long taskId, TaskStage stage) {
        return stageLogMapper.succeed(taskId, stage, now()) > 0;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean fail(long taskId, TaskStage stage, String message) {
        return stageLogMapper.fail(taskId, stage, truncate(message), now()) > 0;
    }

    private static LocalDateTime now() {
        return LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS);
    }

    private static String truncate(String message) {
        if (message == null || message.isBlank()) {
            return "阶段执行失败";
        }
        return message.length() <= MAX_MESSAGE_LENGTH ? message : message.substring(0, MAX_MESSAGE_LENGTH);
    }
}
