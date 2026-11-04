package com.xy.material.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * 统一错误响应。{@code details} 为空时省略，对应 docs/api.md §0.3。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String code, String message, List<Detail> details) {

    public ApiError(String code, String message) {
        this(code, message, null);
    }

    public record Detail(String field, String message) {
    }
}
