package com.xy.material.template;

import java.util.List;

/**
 * 模板详情接口响应，字段见 docs/api.md §3。
 */
public record TemplateDetailDto(
        String id,
        String title,
        CategoryRef category,
        String coverUrl,
        String description,
        int requiredImageCount,
        List<String> acceptedMimeTypes,
        long maxFileSizeBytes
) {
}
