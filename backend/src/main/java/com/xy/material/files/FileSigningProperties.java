package com.xy.material.files;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * /files/** 签名配置。未配置 signingSecret 时由 FileUrlSigner 在启动时随机生成。
 */
@ConfigurationProperties(prefix = "app.files")
public record FileSigningProperties(String signingSecret) {

    public FileSigningProperties {
        if (signingSecret == null) {
            signingSecret = "";
        }
    }
}
