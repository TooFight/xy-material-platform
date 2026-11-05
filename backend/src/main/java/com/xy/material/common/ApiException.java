package com.xy.material.common;

import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * 业务异常：由全局异常处理器转换为统一错误响应。
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<ApiError.Detail> details;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(HttpStatus status, String code, String message, List<ApiError.Detail> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public List<ApiError.Detail> getDetails() {
        return details;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, message);
    }

    public static ApiException validation(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, message);
    }

    public static ApiException fileTooLarge(String message) {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCodes.FILE_TOO_LARGE, message);
    }

    public static ApiException unsupportedFileType(String message) {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCodes.UNSUPPORTED_FILE_TYPE, message);
    }

    public static ApiException devApiDisabled() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.DEV_API_DISABLED, "开发接口未启用");
    }
}
