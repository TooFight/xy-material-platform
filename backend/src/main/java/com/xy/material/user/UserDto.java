package com.xy.material.user;

/**
 * 用户接口响应，字段见 docs/api.md §2。
 */
public record UserDto(long id, String username, String displayName) {

    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getUsername(), user.getDisplayName());
    }
}
