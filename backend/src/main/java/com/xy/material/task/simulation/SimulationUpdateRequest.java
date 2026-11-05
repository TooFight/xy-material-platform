package com.xy.material.task.simulation;

/**
 * PUT /api/dev/simulation 请求体；字段都可选，只更新传入的字段。
 */
public record SimulationUpdateRequest(String failStage, Integer stageDelayMs) {
}
