package com.xy.material;

import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void jsonContentTypeIncludesUtf8Charset() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json;charset=UTF-8"));
    }

    @Test
    void usersArePublic() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].username").value("alice"))
                .andExpect(jsonPath("$[0].displayName").value("Alice"))
                .andExpect(jsonPath("$[2].username").value("carol"));
    }

    @Test
    void templateCategoriesArePublicAndSorted() throws Exception {
        mockMvc.perform(get("/api/template-categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].code").value("creative"))
                .andExpect(jsonPath("$[0].name").value("创意图片"))
                .andExpect(jsonPath("$[0].templateCount").value(3))
                .andExpect(jsonPath("$[1].code").value("festival"))
                .andExpect(jsonPath("$[1].templateCount").value(2))
                .andExpect(jsonPath("$[2].code").value("collage"))
                .andExpect(jsonPath("$[2].templateCount").value(2));
    }

    @Test
    void templateListReturnsSeededTemplatesInOrderAndOnlyCardFields() throws Exception {
        mockMvc.perform(get("/api/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(7)))
                .andExpect(jsonPath("$[0].id").value("demo-postcard"))
                .andExpect(jsonPath("$[0].title").value("旅行明信片"))
                .andExpect(jsonPath("$[0].category.code").value("creative"))
                .andExpect(jsonPath("$[0].category.name").value("创意图片"))
                .andExpect(jsonPath("$[0].coverUrl").value("/demo/covers/postcard.jpg"))
                .andExpect(jsonPath("$[0].requiredImageCount").value(2))
                .andExpect(jsonPath("$[0].description").doesNotExist())
                .andExpect(jsonPath("$[6].id").value("demo-poster"));
    }

    @Test
    void templateListFiltersByCategory() throws Exception {
        mockMvc.perform(get("/api/templates").param("category", "festival"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value("demo-spring-card"))
                .andExpect(jsonPath("$[1].id").value("demo-birthday"));

        mockMvc.perform(get("/api/templates").param("category", "not-a-category"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void templateDetailReturnsFullDefinition() throws Exception {
        mockMvc.perform(get("/api/templates/demo-postcard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("demo-postcard"))
                .andExpect(jsonPath("$.title").value("旅行明信片"))
                .andExpect(jsonPath("$.category.code").value("creative"))
                .andExpect(jsonPath("$.coverUrl").value("/demo/covers/postcard.jpg"))
                .andExpect(jsonPath("$.description").value("上传 2 张照片，模拟生成一张旅行明信片"))
                .andExpect(jsonPath("$.requiredImageCount").value(2))
                .andExpect(jsonPath("$.acceptedMimeTypes", hasSize(2)))
                .andExpect(jsonPath("$.acceptedMimeTypes[0]").value("image/jpeg"))
                .andExpect(jsonPath("$.acceptedMimeTypes[1]").value("image/png"))
                .andExpect(jsonPath("$.maxFileSizeBytes").value(5242880));
    }

    @Test
    void unknownTemplateReturnsUnifiedNotFound() throws Exception {
        mockMvc.perform(get("/api/templates/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.details").doesNotExist());
    }

    @Test
    void meRejectsMissingHeader() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void meRejectsNonNumericHeader() throws Exception {
        mockMvc.perform(get("/api/me").header("X-User-Id", "abc"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meRejectsUnknownUser() throws Exception {
        mockMvc.perform(get("/api/me").header("X-User-Id", "999"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meReturnsCurrentUserForValidHeader() throws Exception {
        mockMvc.perform(get("/api/me").header("X-User-Id", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.username").value("bob"))
                .andExpect(jsonPath("$.displayName").value("Bob"));
    }

    @Test
    void corsPreflightAllowsUserIdHeader() throws Exception {
        mockMvc.perform(options("/api/me")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "X-User-Id"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
                        containsStringIgnoringCase("x-user-id")))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsStringIgnoringCase("GET")));
    }

    @Test
    void corsExposesLocationHeaderOnActualResponse() throws Exception {
        mockMvc.perform(get("/api/users").header(HttpHeaders.ORIGIN, "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        containsStringIgnoringCase("location")));
    }

    @Test
    void demoCoverIsPubliclyServed() throws Exception {
        mockMvc.perform(get("/demo/covers/postcard.jpg"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG));
    }

    @Test
    void jsonTimestampsAreIso8601Utc() throws Exception {
        String json = objectMapper.writeValueAsString(Instant.parse("2026-11-04T08:30:12.345Z"));
        org.assertj.core.api.Assertions.assertThat(json).isEqualTo("\"2026-11-04T08:30:12.345Z\"");
    }

    @Test
    void unknownPathReturnsUnifiedError() throws Exception {
        mockMvc.perform(get("/api/does-not-exist").header("X-User-Id", "1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
