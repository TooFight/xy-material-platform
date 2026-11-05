package com.xy.material.task.simulation;

/**
 * dev API 的模拟配置响应，见 docs/api.md §7。
 */
public record SimulationDto(String failStage, int stageDelayMs) {

    public static SimulationDto from(SimulationSnapshot snapshot) {
        return new SimulationDto(snapshot.failStage(), snapshot.stageDelayMs());
    }
}
