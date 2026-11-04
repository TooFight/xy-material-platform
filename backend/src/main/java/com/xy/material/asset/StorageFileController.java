package com.xy.material.asset;

import com.xy.material.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 公开的本地文件访问入口：/files/** -> APP_STORAGE_DIR。
 * 不校验身份（见 architecture.md §4），但严格校验解析后的真实路径必须在存储根目录内。
 */
@RestController
public class StorageFileController {

    private static final String FILES_PREFIX = "/files/";

    private final AssetStorage assetStorage;

    public StorageFileController(AssetStorage assetStorage) {
        this.assetStorage = assetStorage;
    }

    @GetMapping("/files/**")
    public ResponseEntity<Resource> getFile(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String prefix = request.getContextPath() + FILES_PREFIX;
        if (!requestUri.startsWith(prefix)) {
            throw ApiException.notFound("文件不存在");
        }

        String relativePath = requestUri.substring(prefix.length());
        Path file = assetStorage.resolveFile(relativePath);
        return ResponseEntity.ok()
                .contentType(mediaType(file))
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(new FileSystemResource(file));
    }

    private static MediaType mediaType(Path file) {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG;
        }
        if (name.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }
}
