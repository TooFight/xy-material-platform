package com.xy.material.user;

import com.xy.material.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 解析 X-User-Id：缺失、非正整数或用户不存在时返回 401。
 * 校验通过后把用户放进请求属性，Controller 通过 {@code @CurrentUser} 获取。
 */
@Component
public class UserInterceptor implements HandlerInterceptor {

    private static final String USER_ID_HEADER = "X-User-Id";

    private final UserService userService;

    public UserInterceptor(UserService userService) {
        this.userService = userService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // CORS 预检请求不携带 X-User-Id，交给 CORS 处理。
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String rawUserId = request.getHeader(USER_ID_HEADER);
        if (rawUserId == null || rawUserId.isBlank()) {
            throw ApiException.unauthorized("缺少 X-User-Id 请求头");
        }

        long userId;
        try {
            userId = Long.parseLong(rawUserId.trim());
        } catch (NumberFormatException exception) {
            throw ApiException.unauthorized("X-User-Id 必须是正整数");
        }
        if (userId <= 0) {
            throw ApiException.unauthorized("X-User-Id 必须是正整数");
        }

        User user = userService.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("用户不存在或身份无效"));
        request.setAttribute(User.REQUEST_ATTRIBUTE, user);
        return true;
    }
}
