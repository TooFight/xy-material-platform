package com.xy.material.user;

/**
 * 演示用户，对应 users 表。当前用户会以请求属性形式传给 Controller。
 */
public class User {

    public static final String REQUEST_ATTRIBUTE = User.class.getName();

    private long id;
    private String username;
    private String displayName;

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
