package com.xy.material.asset;

import com.xy.material.common.ApiException;
import com.xy.material.common.ErrorCodes;
import com.xy.material.config.StorageProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

/**
 * 管理 APP_STORAGE_DIR 下的文件读写。
 * 上传时先写 assets/ 下的临时文件，再原子移动到 {uuid}.{ext}；
 * 对外读取时统一做路径归一化和真实路径校验，阻止 ../ 访问存储目录之外。
 */
@Component
public class AssetStorage {

    private static final Logger log = LoggerFactory.getLogger(AssetStorage.class);

    private final Path root;
    private final Path assetsRoot;
    private final Path resultsRoot;

    public AssetStorage(StorageProperties properties) {
        this.root = properties.root();
        this.assetsRoot = root.resolve("assets").normalize();
        this.resultsRoot = root.resolve("results").normalize();
    }

    public StoredFile store(MultipartFile file, ImageFileType type) {
        Path temp = null;
        try {
            Files.createDirectories(assetsRoot);
            temp = Files.createTempFile(assetsRoot, "upload-", ".tmp");
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, temp, StandardCopyOption.REPLACE_EXISTING);
            }

            long size = Files.size(temp);
            if (size <= 0) {
                throw ApiException.validation("文件不能为空");
            }

            String storageKey = "assets/" + UUID.randomUUID() + "." + type.extension();
            Path target = root.resolve(storageKey).normalize();
            if (!target.startsWith(assetsRoot)) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR, "非法存储路径");
            }

            Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE);
            temp = null;
            return new StoredFile(storageKey, target, size);
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            log.error("Failed to store uploaded file", exception);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR, "文件保存失败");
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException exception) {
                    log.warn("Failed to delete temporary upload file {}", temp, exception);
                }
            }
        }
    }

    /**
     * 解析 /files/** 的相对路径；返回真实路径，越界、不存在、目录或符号链接逃逸都按 404 处理。
     */
    public Path resolveFile(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw notFound();
        }

        String decoded;
        try {
            decoded = UriUtils.decode(relativePath, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            throw notFound();
        }

        Path target;
        try {
            target = root.resolve(decoded).normalize();
        } catch (InvalidPathException exception) {
            throw notFound();
        }
        if (!target.startsWith(root)) {
            throw notFound();
        }

        try {
            Path realRoot = root.toRealPath();
            Path realTarget = target.toRealPath();
            if (!realTarget.startsWith(realRoot) || !Files.isRegularFile(realTarget)) {
                throw notFound();
            }
            return realTarget;
        } catch (IOException exception) {
            throw notFound();
        }
    }

    /**
     * B3 CHECKING 使用：素材存储路径是否存在且安全。
     */
    public boolean exists(String storageKey) {
        try {
            resolveFile(storageKey);
            return true;
        } catch (ApiException exception) {
            return false;
        }
    }

    /**
     * B3 FINALIZING 使用：把模板的 classpath 示例结果图复制到 results/{uuid}.png，
     * 返回可访问的 /files/results/{uuid}.png。
     */
    public String copySampleResult(String sampleResultPath) throws IOException {
        if (sampleResultPath == null || sampleResultPath.isBlank()) {
            throw new IOException("Sample result path is blank");
        }
        ClassPathResource sample = new ClassPathResource(sampleResultPath);
        if (!sample.exists()) {
            throw new IOException("Sample result not found: " + sampleResultPath);
        }

        Files.createDirectories(resultsRoot);
        Path temp = Files.createTempFile(resultsRoot, "result-", ".tmp");
        boolean moved = false;
        try {
            try (InputStream input = sample.getInputStream()) {
                Files.copy(input, temp, StandardCopyOption.REPLACE_EXISTING);
            }
            String storageKey = "results/" + UUID.randomUUID() + ".png";
            Path target = root.resolve(storageKey).normalize();
            if (!target.startsWith(resultsRoot)) {
                throw new IOException("Invalid result path");
            }
            Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE);
            moved = true;
            return "/files/" + storageKey;
        } finally {
            if (!moved) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException exception) {
                    log.warn("Failed to delete temporary result file {}", temp, exception);
                }
            }
        }
    }

    public void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            log.warn("Failed to delete stored file {}", path, exception);
        }
    }

    public record StoredFile(String storageKey, Path path, long sizeBytes) {
    }

    private static ApiException notFound() {
        return ApiException.notFound("文件不存在");
    }
}
