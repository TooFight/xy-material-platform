package com.xy.material.config;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 本地文件存储目录，来自 APP_STORAGE_DIR，默认 ./uploads。
 */
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(String dir) {

    public StorageProperties {
        if (dir == null || dir.isBlank()) {
            dir = "./uploads";
        }
    }

    public Path root() {
        return Path.of(dir).toAbsolutePath().normalize();
    }
}
