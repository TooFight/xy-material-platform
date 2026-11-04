package com.xy.material.asset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.xy.material.common.ApiException;
import com.xy.material.config.StorageProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

class AssetStorageTest {

    @TempDir
    private Path tempDir;

    private AssetStorage storage;

    @BeforeEach
    void setUp() {
        storage = new AssetStorage(new StorageProperties(tempDir.toString()));
    }

    @Test
    void detectsJpegPngAndWebpMagicNumbers() {
        assertThat(ImageFileType.detect(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}))
                .contains(ImageFileType.JPEG);
        assertThat(ImageFileType.detect(new byte[]{
                (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
        })).contains(ImageFileType.PNG);
        assertThat(ImageFileType.detect(new byte[]{
                'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'
        })).contains(ImageFileType.WEBP);
        assertThat(ImageFileType.detect("not an image".getBytes(StandardCharsets.UTF_8))).isEmpty();
    }

    @Test
    void storesFileUnderAssetsWithUuidNameAndNoTempLeftBehind() throws IOException {
        byte[] bytes = new byte[]{
                (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3
        };
        MockMultipartFile file = new MockMultipartFile(
                "file", "../../etc/passwd.png", "image/png", bytes);

        AssetStorage.StoredFile stored = storage.store(file, ImageFileType.PNG);

        assertThat(stored.storageKey()).matches("assets/[0-9a-fA-F-]{36}\\.png");
        assertThat(stored.sizeBytes()).isEqualTo(bytes.length);
        Path storedPath = tempDir.resolve(stored.storageKey());
        assertThat(storedPath).isRegularFile();
        assertThat(Files.readAllBytes(storedPath)).isEqualTo(bytes);
        assertThat(storage.resolveFile(stored.storageKey())).isEqualTo(storedPath.toRealPath());

        try (var files = Files.list(tempDir.resolve("assets"))) {
            assertThat(files.map(path -> path.getFileName().toString()))
                    .noneMatch(name -> name.endsWith(".tmp"));
        }
    }

    @Test
    void resolveFileRejectsPathTraversal() {
        assertThatThrownBy(() -> storage.resolveFile("../pom.xml"))
                .isInstanceOf(ApiException.class)
                .satisfies(exception -> assertThat(((ApiException) exception).getStatus())
                        .isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> storage.resolveFile("assets/../../pom.xml"))
                .isInstanceOf(ApiException.class)
                .satisfies(exception -> assertThat(((ApiException) exception).getStatus())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }
}
