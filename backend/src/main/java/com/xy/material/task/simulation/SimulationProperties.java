package com.xy.material.task.simulation;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.simulation.* 配置，见 architecture.md §6.4。
 */
@ConfigurationProperties(prefix = "app.simulation")
public record SimulationProperties(String failStage, Integer stageDelayMs, Boolean devApiEnabled) {

    public SimulationProperties {
        if (failStage == null || failStage.isBlank()) {
            failStage = "NONE";
        }
        if (stageDelayMs == null) {
            stageDelayMs = 3000;
        }
        if (devApiEnabled == null) {
            devApiEnabled = false;
        }
    }
}
