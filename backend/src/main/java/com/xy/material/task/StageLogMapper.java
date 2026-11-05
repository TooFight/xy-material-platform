package com.xy.material.task;

import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface StageLogMapper {

    @Insert("""
            INSERT INTO task_stage_logs (task_id, stage, status, message, started_at, finished_at)
            VALUES (#{taskId}, #{stage,jdbcType=VARCHAR}, 'RUNNING', NULL,
                    #{now,jdbcType=TIMESTAMP}, NULL)
            """)
    int start(@Param("taskId") long taskId,
              @Param("stage") TaskStage stage,
              @Param("now") LocalDateTime now);

    @Update("""
            UPDATE task_stage_logs
               SET status = 'SUCCEEDED',
                   finished_at = #{now,jdbcType=TIMESTAMP}
             WHERE task_id = #{taskId}
               AND stage = #{stage,jdbcType=VARCHAR}
               AND status = 'RUNNING'
            """)
    int succeed(@Param("taskId") long taskId,
                @Param("stage") TaskStage stage,
                @Param("now") LocalDateTime now);

    @Update("""
            UPDATE task_stage_logs
               SET status = 'FAILED',
                   message = #{message,jdbcType=VARCHAR},
                   finished_at = #{now,jdbcType=TIMESTAMP}
             WHERE task_id = #{taskId}
               AND stage = #{stage,jdbcType=VARCHAR}
               AND status = 'RUNNING'
            """)
    int fail(@Param("taskId") long taskId,
             @Param("stage") TaskStage stage,
             @Param("message") String message,
             @Param("now") LocalDateTime now);

    @Select("""
            SELECT id, task_id, stage, status, message, started_at, finished_at
            FROM task_stage_logs
            WHERE task_id = #{taskId}
            ORDER BY id
            """)
    List<StageLogRow> findByTaskId(@Param("taskId") long taskId);
}
