package com.xy.material.template;

import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TemplateMapper {

    String TEMPLATE_SELECT = """
            SELECT t.id AS id,
                   t.category_code AS category_code,
                   c.name AS category_name,
                   t.title AS title,
                   t.description AS description,
                   t.cover_url AS cover_url,
                   t.required_image_count AS required_image_count,
                   t.accepted_mime_types AS accepted_mime_types,
                   t.max_file_size_bytes AS max_file_size_bytes
            FROM templates t
            JOIN template_categories c ON c.code = t.category_code
            """;

    @Select(TEMPLATE_SELECT + " ORDER BY t.sort_order, t.id")
    List<TemplateRow> findAll();

    @Select(TEMPLATE_SELECT + " WHERE t.category_code = #{category} ORDER BY t.sort_order, t.id")
    List<TemplateRow> findByCategory(@Param("category") String category);

    @Select(TEMPLATE_SELECT + " WHERE t.id = #{id}")
    Optional<TemplateRow> findById(@Param("id") String id);

    @Select("""
            SELECT c.code AS code,
                   c.name AS name,
                   (SELECT COUNT(*) FROM templates t WHERE t.category_code = c.code) AS template_count
            FROM template_categories c
            ORDER BY c.sort_order, c.code
            """)
    List<CategoryRow> findCategories();
}
