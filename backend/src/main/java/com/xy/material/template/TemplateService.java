package com.xy.material.template;

import com.xy.material.common.ApiException;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TemplateService {

    private final TemplateMapper templateMapper;

    public TemplateService(TemplateMapper templateMapper) {
        this.templateMapper = templateMapper;
    }

    public List<TemplateCategoryDto> listCategories() {
        return templateMapper.findCategories().stream()
                .map(row -> new TemplateCategoryDto(row.getCode(), row.getName(), row.getTemplateCount()))
                .toList();
    }

    /**
     * 不传 category 返回全部；分类不存在时返回空列表，不报错。
     */
    public List<TemplateListItemDto> listTemplates(String category) {
        List<TemplateRow> rows = (category == null || category.isBlank())
                ? templateMapper.findAll()
                : templateMapper.findByCategory(category.trim());
        return rows.stream().map(this::toListItem).toList();
    }

    public TemplateDetailDto getTemplate(String id) {
        return templateMapper.findById(id)
                .map(this::toDetail)
                .orElseThrow(() -> ApiException.notFound("模板不存在"));
    }

    private TemplateListItemDto toListItem(TemplateRow row) {
        return new TemplateListItemDto(
                row.getId(),
                row.getTitle(),
                new CategoryRef(row.getCategoryCode(), row.getCategoryName()),
                row.getCoverUrl(),
                row.getRequiredImageCount()
        );
    }

    private TemplateDetailDto toDetail(TemplateRow row) {
        return new TemplateDetailDto(
                row.getId(),
                row.getTitle(),
                new CategoryRef(row.getCategoryCode(), row.getCategoryName()),
                row.getCoverUrl(),
                row.getDescription(),
                row.getRequiredImageCount(),
                parseMimeTypes(row.getAcceptedMimeTypes()),
                row.getMaxFileSizeBytes()
        );
    }

    private static List<String> parseMimeTypes(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .toList();
    }
}
