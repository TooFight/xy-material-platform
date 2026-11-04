package com.xy.material.user;

import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper {

    @Select("SELECT id, username, display_name FROM users ORDER BY id")
    List<User> findAll();

    @Select("SELECT id, username, display_name FROM users WHERE id = #{id}")
    Optional<User> findById(@Param("id") long id);
}
