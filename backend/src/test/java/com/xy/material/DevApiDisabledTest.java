package com.xy.material;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DevApiDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getReturnsDevApiDisabledWhenNotEnabled() throws Exception {
        mockMvc.perform(get("/api/dev/simulation"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DEV_API_DISABLED"));
    }

    @Test
    void putReturnsDevApiDisabledWhenNotEnabled() throws Exception {
        mockMvc.perform(put("/api/dev/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"failStage\":\"GENERATING\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DEV_API_DISABLED"));
    }
}
