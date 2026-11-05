package com.xy.material.asset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.xy.material.config.StorageProperties;
import com.xy.material.files.FileSigningProperties;
import com.xy.material.files.FileUrlSigner;
import com.xy.material.template.CategoryRef;
import com.xy.material.template.TemplateDetailDto;
import com.xy.material.template.TemplateService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @TempDir
    private Path tempDir;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private TemplateService templateService;

    private AssetService assetService;

    @BeforeEach
    void setUp() {
        AssetStorage storage = new AssetStorage(new StorageProperties(tempDir.toString()));
        FileUrlSigner signer = new FileUrlSigner(new FileSigningProperties("test-secret"));
        assetService = new AssetService(assetMapper, templateService, storage, signer);
    }

    @Test
    void deletesStoredFileWhenDatabaseInsertFails() throws Exception {
        when(templateService.getTemplate("demo-postcard")).thenReturn(new TemplateDetailDto(
                "demo-postcard",
                "旅行明信片",
                new CategoryRef("creative", "创意图片"),
                "/demo/covers/postcard.png",
                "上传 2 张照片，模拟生成一张旅行明信片",
                2,
                List.of("image/jpeg", "image/png"),
                5242880L
        ));
        when(assetMapper.insert(any(Asset.class)))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", new byte[]{
                (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3
        });

        assertThatThrownBy(() -> assetService.upload(1, "demo-postcard", file))
                .isInstanceOf(DataAccessResourceFailureException.class);

        Path assets = tempDir.resolve("assets");
        try (var paths = Files.walk(assets)) {
            assertThat(paths.filter(path -> Files.isRegularFile(path)).count()).isZero();
        }
    }
}
