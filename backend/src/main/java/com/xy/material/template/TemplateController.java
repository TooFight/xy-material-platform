package com.xy.material.template;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping("/template-categories")
    public List<TemplateCategoryDto> listCategories() {
        return templateService.listCategories();
    }

    @GetMapping("/templates")
    public List<TemplateListItemDto> listTemplates(
            @RequestParam(name = "category", required = false) String category) {
        return templateService.listTemplates(category);
    }

    @GetMapping("/templates/{id}")
    public TemplateDetailDto getTemplate(@PathVariable("id") String id) {
        return templateService.getTemplate(id);
    }
}
