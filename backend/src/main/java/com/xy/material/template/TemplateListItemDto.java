package com.xy.material.template;

/**
 * 模板列表项，只包含卡片需要的字段，见 docs/api.md §3。
 */
public record TemplateListItemDto(
        String id,
        String title,
        CategoryRef category,
        String coverUrl,
        int requiredImageCount
) {
}
