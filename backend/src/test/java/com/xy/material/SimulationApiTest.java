package com.xy.material;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.xy.material.task.simulation.SimulationConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.simulation.dev-api-enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SimulationApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SimulationConfig simulationConfig;

    @BeforeEach
    @AfterEach
    void reset() {
        simulationConfig.update("NONE", 0);
    }

    @Test
    void getReturnsCurrentSimulationConfig() throws Exception {
        mockMvc.perform(get("/api/dev/simulation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failStage").value("NONE"))
                .andExpect(jsonPath("$.stageDelayMs").value(0));
    }

    @Test
    void putUpdatesOnlyProvidedFields() throws Exception {
        mockMvc.perform(put("/api/dev/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"failStage\":\"GENERATING\",\"stageDelayMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failStage").value("GENERATING"))
                .andExpect(jsonPath("$.stageDelayMs").value(5000));

        mockMvc.perform(put("/api/dev/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stageDelayMs\":2500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failStage").value("GENERATING"))
                .andExpect(jsonPath("$.stageDelayMs").value(2500));

        mockMvc.perform(put("/api/dev/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"failStage\":\"NONE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failStage").value("NONE"))
                .andExpect(jsonPath("$.stageDelayMs").value(2500));
    }

    @Test
    void putRejectsStageDelayOutOfRange() throws Exception {
        mockMvc.perform(put("/api/dev/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stageDelayMs\":60001}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void putRejectsUnknownFailStage() throws Exception {
        mockMvc.perform(put("/api/dev/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"failStage\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
}
