package com.xy.material.task;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 服务重启后不续跑：把启动前遗留的 PENDING / RUNNING 任务终结为 FAILED。
 *
 * <p>启动时刻在 bean 构造时记录，此时 Web 服务还没有开始接收请求；
 * 清理只处理 created_at 早于该时刻的任务，避免误杀启动瞬间提交的新任务。
 */
@Component
public class StartupCleanup {

    private static final Logger log = LoggerFactory.getLogger(StartupCleanup.class);
    private static final String REASON = "服务重启，任务已中断";

    private final StartupCleanupStore cleanupStore;
    private final LocalDateTime startupAt;

    public StartupCleanup(StartupCleanupStore cleanupStore) {
        this.cleanupStore = cleanupStore;
        this.startupAt = LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void cleanup() {
        int cleaned = cleanupStore.cleanup(REASON, startupAt);
        if (cleaned > 0) {
            log.warn("Marked {} unfinished tasks as FAILED after restart", cleaned);
        }
    }

    /**
     * 测试用：本次启动的清理截止时间。
     */
    public LocalDateTime startupAt() {
        return startupAt;
    }
}
