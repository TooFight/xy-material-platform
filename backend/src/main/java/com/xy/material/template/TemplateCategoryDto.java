package com.xy.material.template;

/**
 * 模板分类接口响应，字段见 docs/api.md §3。
 */
public record TemplateCategoryDto(String code, String name, long templateCount) {
}
