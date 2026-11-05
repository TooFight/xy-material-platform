package com.xy.material.task.simulation;

/**
 * 受理任务时快照到 tasks 行的模拟配置。
 */
public record SimulationSnapshot(String failStage, int stageDelayMs) {

    public static final String NONE = "NONE";
}
