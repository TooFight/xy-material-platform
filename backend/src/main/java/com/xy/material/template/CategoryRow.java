package com.xy.material.template;

/**
 * 分类及模板数量的查询结果行。
 */
public class CategoryRow {

    private String code;
    private String name;
    private long templateCount;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public long getTemplateCount() {
        return templateCount;
    }

    public void setTemplateCount(long templateCount) {
        this.templateCount = templateCount;
    }
}
