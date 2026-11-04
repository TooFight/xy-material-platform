package com.xy.material.common;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 所有非 2xx 响应统一为 {code, message, details}，见 docs/api.md §0.3。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException exception) {
        ApiError error = new ApiError(exception.getCode(), exception.getMessage(), exception.getDetails());
        return ResponseEntity.status(exception.getStatus()).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<ApiError.Detail> details = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiError.Detail(error.getField(), error.getDefaultMessage()))
                .toList();
        return badRequest(new ApiError(ErrorCodes.VALIDATION_ERROR, "请求参数校验失败", details));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiError> handleMethodValidation(HandlerMethodValidationException exception) {
        return badRequest(new ApiError(ErrorCodes.VALIDATION_ERROR, "请求参数校验失败", null));
    }

    @ExceptionHandler({
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class
    })
    public ResponseEntity<ApiError> handleBadRequest(Exception exception) {
        return badRequest(new ApiError(ErrorCodes.VALIDATION_ERROR, messageFor(exception), null));
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiError> handleNotFound(Exception exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError(ErrorCodes.NOT_FOUND, "请求的资源不存在", null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception exception) {
        log.error("Unhandled exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError(ErrorCodes.INTERNAL_ERROR, "服务器内部错误", null));
    }

    private static ResponseEntity<ApiError> badRequest(ApiError error) {
        return ResponseEntity.badRequest().body(error);
    }

    private static String messageFor(Exception exception) {
        if (exception instanceof MissingServletRequestParameterException missing) {
            return "缺少必需的请求参数: " + missing.getParameterName();
        }
        if (exception instanceof MethodArgumentTypeMismatchException mismatch) {
            return "请求参数格式错误: " + mismatch.getName();
        }
        return "请求体格式错误";
    }
}
