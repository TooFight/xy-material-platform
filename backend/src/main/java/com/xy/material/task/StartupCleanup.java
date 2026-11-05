package com.xy.material.task;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 服务重启后不续跑：把遗留的 PENDING / RUNNING 任务终结为 FAILED。
 */
@Component
public class StartupCleanup {

    private static final Logger log = LoggerFactory.getLogger(StartupCleanup.class);

    private final TaskStore taskStore;

    public StartupCleanup(TaskStore taskStore) {
        this.taskStore = taskStore;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void cleanup() {
        int cleaned = taskStore.failUnfinished("服务重启，任务已中断");
        if (cleaned > 0) {
            log.warn("Marked {} unfinished tasks as FAILED after restart", cleaned);
        }
    }
}
