package com.xy.material;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xy.material.asset.AssetService;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AssetApiTest.MaxUploadTestController.class)
class AssetApiTest {

    private static final Path STORAGE_DIR = createStorageDirectory();

    static {
        System.setProperty("java.awt.headless", "true");
    }

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("app.storage.dir", STORAGE_DIR::toString);
    }

    @AfterAll
    static void cleanStorage() throws IOException {
        if (!Files.exists(STORAGE_DIR)) {
            return;
        }
        try (var paths = Files.walk(STORAGE_DIR)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // 临时目录清理失败不影响测试结论。
                }
            });
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AssetService assetService;

    @Test
    void uploadJpegStoresFileAndDatabaseRecord() throws Exception {
        byte[] bytes = imageBytes("jpg");
        MvcResult result = upload("demo-postcard", "beach.jpg", "image/jpeg", bytes, "1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.templateId").value("demo-postcard"))
                .andExpect(jsonPath("$.originalFilename").value("beach.jpg"))
                .andExpect(jsonPath("$.mimeType").value("image/jpeg"))
                .andExpect(jsonPath("$.sizeBytes").value(bytes.length))
                .andExpect(jsonPath("$.url").value(matchesPattern(
                        "/files/assets/[0-9a-fA-F-]{36}\\.jpg\\?exp=\\d+&sig=[A-Za-z0-9_-]+")))
                .andExpect(jsonPath("$.createdAt").value(matchesPattern(".+Z")))
                .andReturn();

        assertStored(readJson(result), bytes, "demo-postcard", "image/jpeg", "beach.jpg", "jpg");
    }

    @Test
    void uploadPngStoresFileAndDatabaseRecord() throws Exception {
        byte[] bytes = imageBytes("png");
        MvcResult result = upload("demo-polaroid", "city.png", "image/png", bytes, "1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.templateId").value("demo-polaroid"))
                .andExpect(jsonPath("$.originalFilename").value("city.png"))
                .andExpect(jsonPath("$.mimeType").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(bytes.length))
                .andExpect(jsonPath("$.url").value(matchesPattern(
                        "/files/assets/[0-9a-fA-F-]{36}\\.png\\?exp=\\d+&sig=[A-Za-z0-9_-]+")))
                .andReturn();

        assertStored(readJson(result), bytes, "demo-polaroid", "image/png", "city.png", "png");
    }

    @Test
    void textFileRenamedToJpgReturns415() throws Exception {
        upload("demo-postcard", "note.jpg", "image/jpeg",
                "this is not an image".getBytes(StandardCharsets.UTF_8), "1")
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
    }

    @Test
    void webpForJpegPngOnlyTemplateReturns415() throws Exception {
        byte[] webpHeader = new byte[]{
                'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'
        };
        upload("demo-postcard", "image.webp", "image/webp", webpHeader, "1")
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
    }

    @Test
    void oversizedFileReturns413() throws Exception {
        byte[] oversized = new byte[2 * 1024 * 1024 + 1];
        upload("demo-grid9", "huge.png", "image/png", oversized, "1")
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }

    @Test
    void emptyFileReturns400() throws Exception {
        upload("demo-postcard", "empty.png", "image/png", new byte[0], "1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void unknownTemplateReturns404() throws Exception {
        upload("missing-template", "photo.png", "image/png", imageBytes("png"), "1")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void missingUserHeaderReturns401() throws Exception {
        upload("demo-postcard", "photo.png", "image/png", imageBytes("png"), null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void maliciousFilenameDoesNotAffectStoragePath() throws Exception {
        byte[] bytes = imageBytes("png");
        MvcResult result = upload("demo-postcard", "../../etc/passwd.png", "image/png", bytes, "1")
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode body = readJson(result);
        long id = body.get("id").asLong();
        String url = body.get("url").asText();
        String storageKey = jdbcTemplate.queryForObject(
                "SELECT storage_key FROM assets WHERE id = ?", String.class, id);

        assertThat(url).matches(
                "/files/assets/[0-9a-fA-F-]{36}\\.png\\?exp=\\d+&sig=[A-Za-z0-9_-]+");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT original_filename FROM assets WHERE id = ?", String.class, id))
                .isEqualTo("passwd.png");
        assertThat(storageKey).startsWith("assets/").doesNotContain("..").doesNotContain("etc")
                .doesNotContain("?exp=").doesNotContain("sig=");

        Path stored = storedPath(url);
        assertThat(stored).isRegularFile();
        assertThat(stored.startsWith(STORAGE_DIR.resolve("assets").normalize())).isTrue();
        assertThat(Files.exists(STORAGE_DIR.getParent().resolve("etc/passwd.png"))).isFalse();
    }

    @Test
    void filesPathTraversalIsRejected() throws Exception {
        mockMvc.perform(get("/files/%2e%2e/pom.xml"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void maxUploadSizeExceptionReturns413() throws Exception {
        mockMvc.perform(get("/__test/max-upload").header("X-User-Id", "1"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }

    @Test
    void findOwnedAssetsFiltersByUser() throws Exception {
        byte[] bytes = imageBytes("png");
        MvcResult result = upload("demo-postcard", "owned.png", "image/png", bytes, "1")
                .andExpect(status().isCreated())
                .andReturn();
        long assetId = readJson(result).get("id").asLong();

        assertThat(assetService.findOwnedAssets(1, List.of(assetId))).hasSize(1);
        assertThat(assetService.findOwnedAssets(2, List.of(assetId))).isEmpty();
        assertThat(assetService.findOwnedAssets(1, List.of())).isEmpty();
    }

    private ResultActions upload(String templateId, String filename, String contentType,
                                 byte[] bytes, String userId) throws Exception {
        var request = multipart("/api/assets")
                .file(new MockMultipartFile("file", filename, contentType, bytes))
                .param("templateId", templateId);
        if (userId != null) {
            request.header("X-User-Id", userId);
        }
        return mockMvc.perform(request);
    }

    private JsonNode readJson(MvcResult result) throws IOException {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private void assertStored(JsonNode body, byte[] bytes, String templateId,
                              String mimeType, String originalFilename, String extension) throws Exception {
        long id = body.get("id").asLong();
        String url = body.get("url").asText();

        assertThat(body.get("templateId").asText()).isEqualTo(templateId);
        assertThat(body.get("mimeType").asText()).isEqualTo(mimeType);
        assertThat(body.get("sizeBytes").asLong()).isEqualTo(bytes.length);
        assertThat(body.get("originalFilename").asText()).isEqualTo(originalFilename);
        assertThat(url).matches("/files/assets/[0-9a-fA-F-]{36}\\." + extension
                + "\\?exp=\\d+&sig=[A-Za-z0-9_-]+");
        Instant.parse(body.get("createdAt").asText());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT user_id FROM assets WHERE id = ?", Long.class, id)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT template_id FROM assets WHERE id = ?", String.class, id)).isEqualTo(templateId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT mime_type FROM assets WHERE id = ?", String.class, id)).isEqualTo(mimeType);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT size_bytes FROM assets WHERE id = ?", Long.class, id)).isEqualTo((long) bytes.length);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT original_filename FROM assets WHERE id = ?", String.class, id)).isEqualTo(originalFilename);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT storage_key FROM assets WHERE id = ?", String.class, id))
                .startsWith("assets/").doesNotContain("?exp=").doesNotContain("sig=");

        Path stored = storedPath(url);
        assertThat(stored).isRegularFile();
        assertThat(Files.readAllBytes(stored)).isEqualTo(bytes);

        mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(content().contentType(mimeType))
                .andExpect(content().bytes(bytes));
    }

    private Path storedPath(String url) {
        int query = url.indexOf('?');
        String path = query >= 0 ? url.substring(0, query) : url;
        return STORAGE_DIR.resolve(path.substring("/files/".length())).normalize();
    }

    private static byte[] imageBytes(String format) throws IOException {
        BufferedImage image = new BufferedImage(24, 24, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(40, 120, 200));
        graphics.fillRect(0, 0, 24, 24);
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, output)) {
            throw new IllegalStateException("No ImageIO writer for " + format);
        }
        return output.toByteArray();
    }

    private static Path createStorageDirectory() {
        try {
            return Files.createTempDirectory("xy-asset-api-");
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    @RestController
    static class MaxUploadTestController {

        @GetMapping("/__test/max-upload")
        public void maxUpload() {
            throw new MaxUploadSizeExceededException(10L * 1024 * 1024);
        }
    }
}
