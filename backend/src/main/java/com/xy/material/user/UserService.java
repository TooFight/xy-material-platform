package com.xy.material.user;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserMapper userMapper;

    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public List<UserDto> listUsers() {
        return userMapper.findAll().stream().map(UserDto::from).toList();
    }

    /**
     * Service 层只接收显式传入的 userId，不读取请求上下文。
     */
    public Optional<User> findById(long userId) {
        return userMapper.findById(userId);
    }
}
