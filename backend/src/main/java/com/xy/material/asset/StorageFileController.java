package com.xy.material.asset;

import com.xy.material.common.ApiException;
import com.xy.material.files.FileUrlSigner;
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
 * 本地文件访问入口：/files/** -> APP_STORAGE_DIR。
 * 不校验 X-User-Id，但要求 URL 带有有效的 exp/sig 签名；
 * 签名错误或过期统一返回 404。路径穿越防护与之前一致。
 */
@RestController
public class StorageFileController {

    private static final String FILES_PREFIX = "/files/";

    private final AssetStorage assetStorage;
    private final FileUrlSigner fileUrlSigner;

    public StorageFileController(AssetStorage assetStorage, FileUrlSigner fileUrlSigner) {
        this.assetStorage = assetStorage;
        this.fileUrlSigner = fileUrlSigner;
    }

    @GetMapping("/files/**")
    public ResponseEntity<Resource> getFile(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!path.startsWith(FILES_PREFIX)) {
            throw ApiException.notFound("文件不存在");
        }

        String expRaw = request.getParameter("exp");
        String signature = request.getParameter("sig");
        if (expRaw == null || signature == null) {
            throw ApiException.notFound("文件不存在");
        }

        long exp;
        try {
            exp = Long.parseLong(expRaw);
        } catch (NumberFormatException exception) {
            throw ApiException.notFound("文件不存在");
        }
        if (!fileUrlSigner.verify(path, exp, signature)) {
            throw ApiException.notFound("文件不存在");
        }

        String relativePath = path.substring(FILES_PREFIX.length());
        Path file = assetStorage.resolveFile(relativePath);
        return ResponseEntity.ok()
                .contentType(mediaType(file))
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
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
