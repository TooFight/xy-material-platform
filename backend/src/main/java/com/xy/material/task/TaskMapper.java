package com.xy.material.task;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TaskMapper {

    String TASK_SELECT = """
            SELECT t.id, t.user_id, t.template_id, t.status, t.stage, t.failed_stage, t.failure_reason,
                   t.result_url, t.sim_fail_stage, t.sim_stage_delay_ms, t.created_at, t.started_at,
                   t.finished_at, t.updated_at,
                   tp.title AS template_title,
                   tp.cover_url AS template_cover_url,
                   tp.sample_result_path AS sample_result_path
            FROM tasks t
            JOIN templates tp ON tp.id = t.template_id
            """;

    @Insert("""
            INSERT INTO tasks (user_id, template_id, status, stage, failed_stage, failure_reason, result_url,
                               sim_fail_stage, sim_stage_delay_ms, created_at, started_at, finished_at, updated_at)
            VALUES (#{userId}, #{templateId}, #{status,jdbcType=VARCHAR},
                    #{stage,jdbcType=VARCHAR}, #{failedStage,jdbcType=VARCHAR},
                    #{failureReason,jdbcType=VARCHAR}, #{resultUrl,jdbcType=VARCHAR},
                    #{simFailStage}, #{simStageDelayMs},
                    #{createdAt,jdbcType=TIMESTAMP}, #{startedAt,jdbcType=TIMESTAMP},
                    #{finishedAt,jdbcType=TIMESTAMP}, #{updatedAt,jdbcType=TIMESTAMP})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insert(TaskRow task);

    @Select(TASK_SELECT + " WHERE t.id = #{id}")
    Optional<TaskRow> findById(@Param("id") long id);

    @Select(TASK_SELECT + """
             WHERE t.user_id = #{userId}
             ORDER BY t.created_at DESC, t.id DESC
             LIMIT #{size} OFFSET #{offset}
            """)
    List<TaskRow> findPage(@Param("userId") long userId,
                           @Param("offset") long offset,
                           @Param("size") int size);

    @Select("SELECT COUNT(*) FROM tasks WHERE user_id = #{userId}")
    long countByUserId(@Param("userId") long userId);

    @Select(TASK_SELECT + """
             WHERE t.user_id = #{userId}
               AND t.status IN ('PENDING', 'RUNNING')
             ORDER BY t.created_at DESC, t.id DESC
            """)
    List<TaskRow> findActiveByUserId(@Param("userId") long userId);

    @Update("""
            UPDATE tasks
               SET status = 'RUNNING',
                   stage = #{stage,jdbcType=VARCHAR},
                   started_at = COALESCE(started_at, #{now,jdbcType=TIMESTAMP}),
                   updated_at = #{now,jdbcType=TIMESTAMP}
             WHERE id = #{id}
               AND status IN ('PENDING', 'RUNNING')
            """)
    int enterStage(@Param("id") long id,
                   @Param("stage") TaskStage stage,
                   @Param("now") LocalDateTime now);

    @Update("""
            UPDATE tasks
               SET status = 'FAILED',
                   failed_stage = #{stage,jdbcType=VARCHAR},
                   failure_reason = #{reason,jdbcType=VARCHAR},
                   finished_at = #{now,jdbcType=TIMESTAMP},
                   updated_at = #{now,jdbcType=TIMESTAMP}
             WHERE id = #{id}
               AND status IN ('PENDING', 'RUNNING')
            """)
    int fail(@Param("id") long id,
             @Param("stage") TaskStage stage,
             @Param("reason") String reason,
             @Param("now") LocalDateTime now);

    @Update("""
            UPDATE tasks
               SET status = 'SUCCEEDED',
                   result_url = #{resultUrl,jdbcType=VARCHAR},
                   finished_at = #{now,jdbcType=TIMESTAMP},
                   updated_at = #{now,jdbcType=TIMESTAMP}
             WHERE id = #{id}
               AND status = 'RUNNING'
            """)
    int succeed(@Param("id") long id,
                @Param("resultUrl") String resultUrl,
                @Param("now") LocalDateTime now);

    @Update("""
            UPDATE tasks
               SET status = 'FAILED',
                   failed_stage = NULL,
                   failure_reason = #{reason,jdbcType=VARCHAR},
                   result_url = NULL,
                   finished_at = #{now,jdbcType=TIMESTAMP},
                   updated_at = #{now,jdbcType=TIMESTAMP}
             WHERE status IN ('PENDING', 'RUNNING')
            """)
    int failUnfinished(@Param("reason") String reason, @Param("now") LocalDateTime now);
}
