package com.xy.material.files;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.xy.material.asset.AssetDto;
import com.xy.material.asset.AssetService;
import com.xy.material.support.TestImages;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FileSigningApiTest {

    private static final Path STORAGE_DIR = createStorageDirectory();

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
    private AssetService assetService;

    @Autowired
    private FileUrlSigner fileUrlSigner;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void signedAssetUrlIsAccessibleAndStableWithinWindow() throws Exception {
        AssetDto asset = uploadPng();
        String url = asset.url();

        assertThat(url).matches("/files/assets/[0-9a-fA-F-]{36}\\.png\\?exp=\\d+&sig=[A-Za-z0-9_-]+");
        String path = unsignedPath(url);
        String firstSign = fileUrlSigner.sign(path);
        String secondSign = fileUrlSigner.sign(path);
        assertThat(secondSign).isEqualTo(firstSign);
        assertThat(firstSign).isEqualTo(url);

        mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("private")))
                .andExpect(status().isOk());

        String storageKey = jdbcTemplate.queryForObject(
                "SELECT storage_key FROM assets WHERE id = ?", String.class, asset.id());
        assertThat(storageKey).startsWith("assets/").doesNotContain("?exp=").doesNotContain("sig=");
    }

    @Test
    void tamperedMissingAndExpiredSignatureReturn404() throws Exception {
        AssetDto asset = uploadPng();
        String url = asset.url();
        String path = unsignedPath(url);
        long exp = expOf(url);

        String tampered = url.substring(0, url.length() - 1)
                + (url.endsWith("A") ? "B" : "A");
        mockMvc.perform(get(tampered))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        mockMvc.perform(get(path))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        long expired = Instant.now().getEpochSecond() - 1;
        String expiredUrl = path + "?exp=" + expired + "&sig=" + fileUrlSigner.signature(path, expired);
        mockMvc.perform(get(expiredUrl))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        assertThat(fileUrlSigner.verify(path, exp, sigOf(url))).isTrue();
    }

    private AssetDto uploadPng() {
        return assetService.upload(1, "demo-postcard", new MockMultipartFile(
                "file", "signature.png", "image/png", TestImages.png()));
    }

    private static String unsignedPath(String url) {
        return url.substring(0, url.indexOf('?'));
    }

    private static long expOf(String url) {
        int start = url.indexOf("exp=") + 4;
        int end = url.indexOf("&sig=");
        return Long.parseLong(url.substring(start, end));
    }

    private static String sigOf(String url) {
        return url.substring(url.indexOf("&sig=") + 5);
    }

    private static Path createStorageDirectory() {
        try {
            return Files.createTempDirectory("xy-signing-api-");
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
