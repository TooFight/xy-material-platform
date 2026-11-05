package com.xy.material.task.simulation;

import com.xy.material.common.ApiException;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.stereotype.Component;

/**
 * 线程安全的运行时模拟配置。任务受理时通过 snapshot() 生成不可变快照。
 */
@Component
public class SimulationConfig {

    private static final Set<String> ALLOWED_STAGES =
            Set.of("NONE", "CHECKING", "GENERATING", "FINALIZING");

    private final boolean devApiEnabled;
    private final AtomicReference<SimulationSnapshot> current;

    public SimulationConfig(SimulationProperties properties) {
        this.devApiEnabled = Boolean.TRUE.equals(properties.devApiEnabled());
        SimulationSnapshot initial = new SimulationSnapshot(
                normalizeFailStage(properties.failStage()),
                validateDelay(properties.stageDelayMs())
        );
        this.current = new AtomicReference<>(initial);
    }

    public boolean devApiEnabled() {
        return devApiEnabled;
    }

    public SimulationSnapshot snapshot() {
        return current.get();
    }

    public synchronized SimulationSnapshot update(String failStage, Integer stageDelayMs) {
        SimulationSnapshot old = current.get();
        if (failStage == null && stageDelayMs == null) {
            return old;
        }
        String nextFailStage = failStage == null ? old.failStage() : normalizeFailStage(failStage);
        int nextDelay = stageDelayMs == null ? old.stageDelayMs() : validateDelay(stageDelayMs);
        SimulationSnapshot next = new SimulationSnapshot(nextFailStage, nextDelay);
        current.set(next);
        return next;
    }

    public static String normalizeFailStage(String failStage) {
        if (failStage == null || failStage.isBlank()) {
            throw ApiException.validation("failStage 不能为空");
        }
        String normalized = failStage.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STAGES.contains(normalized)) {
            throw ApiException.validation("failStage 必须是 NONE/CHECKING/GENERATING/FINALIZING");
        }
        return normalized;
    }

    public static int validateDelay(Integer stageDelayMs) {
        if (stageDelayMs == null || stageDelayMs < 0 || stageDelayMs > 60000) {
            throw ApiException.validation("stageDelayMs 必须在 0~60000 之间");
        }
        return stageDelayMs;
    }
}
