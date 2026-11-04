package com.xy.material.common;

/**
 * 错误响应中的稳定错误码，取值必须与 docs/api.md §0.3 保持一致。
 */
public final class ErrorCodes {

    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    public static final String UNAUTHORIZED = "UNAUTHORIZED";
    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String FILE_TOO_LARGE = "FILE_TOO_LARGE";
    public static final String UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE";
    public static final String DEV_API_DISABLED = "DEV_API_DISABLED";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    private ErrorCodes() {
    }
}
