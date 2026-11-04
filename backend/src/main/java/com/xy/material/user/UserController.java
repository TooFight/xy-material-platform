package com.xy.material.user;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 公开接口：列出演示用户，供前端身份切换器使用。
     */
    @GetMapping("/users")
    public List<UserDto> listUsers() {
        return userService.listUsers();
    }

    /**
     * 需要 X-User-Id：返回当前身份，供前端确认本地保存的身份仍有效。
     */
    @GetMapping("/me")
    public UserDto me(@CurrentUser User currentUser) {
        return UserDto.from(currentUser);
    }
}
