package com.xy.material.task;

import java.util.Collection;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TaskAssetMapper {

    @Insert("""
            INSERT INTO task_assets (task_id, slot_index, asset_id)
            VALUES (#{taskId}, #{slotIndex}, #{assetId})
            """)
    int insert(@Param("taskId") long taskId,
               @Param("slotIndex") int slotIndex,
               @Param("assetId") long assetId);

    @Select("""
            <script>
            SELECT ta.task_id, ta.slot_index, a.id AS asset_id, a.storage_key, a.mime_type, a.size_bytes
            FROM task_assets ta
            JOIN assets a ON a.id = ta.asset_id
            WHERE ta.task_id IN
            <foreach collection="taskIds" item="taskId" open="(" separator="," close=")">#{taskId}</foreach>
            ORDER BY ta.task_id, ta.slot_index
            </script>
            """)
    List<TaskAssetRow> findByTaskIds(@Param("taskIds") Collection<Long> taskIds);
}
