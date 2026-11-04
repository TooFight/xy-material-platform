package com.xy.material.asset;

import java.util.Collection;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AssetMapper {

    @Insert("""
            INSERT INTO assets (user_id, template_id, storage_key, original_filename, mime_type, size_bytes, created_at)
            VALUES (#{userId}, #{templateId}, #{storageKey}, #{originalFilename}, #{mimeType}, #{sizeBytes}, #{createdAt})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insert(Asset asset);

    @Select("""
            <script>
            SELECT id, user_id, template_id, storage_key, original_filename, mime_type, size_bytes, created_at
            FROM assets
            WHERE user_id = #{userId}
              AND id IN
              <foreach collection="assetIds" item="assetId" open="(" separator="," close=")">#{assetId}</foreach>
            ORDER BY id
            </script>
            """)
    List<Asset> findByUserIdAndIds(@Param("userId") long userId, @Param("assetIds") Collection<Long> assetIds);
}
