package com.xy.material.task.simulation;

import com.xy.material.common.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仅当 app.simulation.dev-api-enabled=true 时可用；否则统一返回 404 DEV_API_DISABLED。
 * /api/dev/** 已在身份拦截器中公开，不需要 X-User-Id。
 */
@RestController
@RequestMapping("/api/dev")
public class SimulationController {

    private final SimulationConfig simulationConfig;

    public SimulationController(SimulationConfig simulationConfig) {
        this.simulationConfig = simulationConfig;
    }

    @GetMapping("/simulation")
    public SimulationDto get() {
        requireEnabled();
        return SimulationDto.from(simulationConfig.snapshot());
    }

    @PutMapping("/simulation")
    public SimulationDto update(@RequestBody(required = false) SimulationUpdateRequest request) {
        requireEnabled();
        if (request == null) {
            return SimulationDto.from(simulationConfig.snapshot());
        }
        return SimulationDto.from(simulationConfig.update(request.failStage(), request.stageDelayMs()));
    }

    private void requireEnabled() {
        if (!simulationConfig.devApiEnabled()) {
            throw ApiException.devApiDisabled();
        }
    }
}
