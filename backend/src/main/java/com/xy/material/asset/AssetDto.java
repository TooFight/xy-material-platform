package com.xy.material.asset;

import java.time.Instant;
import java.time.ZoneOffset;

/**
 * 素材上传响应，字段见 docs/api.md §4。
 */
public record AssetDto(
        long id,
        String templateId,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        String url,
        Instant createdAt
) {

    public static AssetDto from(Asset asset) {
        return new AssetDto(
                asset.getId(),
                asset.getTemplateId(),
                asset.getOriginalFilename(),
                asset.getMimeType(),
                asset.getSizeBytes(),
                asset.getUrl(),
                asset.getCreatedAt().toInstant(ZoneOffset.UTC)
        );
    }
}
