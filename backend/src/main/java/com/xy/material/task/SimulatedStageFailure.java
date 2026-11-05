package com.xy.material.task;

/**
 * 模拟配置指定的阶段失败。
 */
public class SimulatedStageFailure extends RuntimeException {

    private final TaskStage stage;

    public SimulatedStageFailure(TaskStage stage) {
        super("Simulated failure at " + stage);
        this.stage = stage;
    }

    public TaskStage getStage() {
        return stage;
    }
}
