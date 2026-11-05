package com.xy.material.task;

import com.xy.material.config.TaskExecutorConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Component;

/**
 * 事务提交后把任务投递到有界线程池；队列满时把任务标记为 FAILED。
 */
@Component
public class TaskDispatcher {

    private static final Logger log = LoggerFactory.getLogger(TaskDispatcher.class);

    private final TaskExecutor taskExecutor;
    private final TaskPipelineRunner taskPipelineRunner;
    private final TaskStore taskStore;

    public TaskDispatcher(
            @Qualifier(TaskExecutorConfig.TASK_PIPELINE_EXECUTOR) TaskExecutor taskExecutor,
            TaskPipelineRunner taskPipelineRunner,
            TaskStore taskStore) {
        this.taskExecutor = taskExecutor;
        this.taskPipelineRunner = taskPipelineRunner;
        this.taskStore = taskStore;
    }

    public void dispatch(long taskId) {
        try {
            taskExecutor.execute(() -> taskPipelineRunner.run(taskId));
        } catch (TaskRejectedException exception) {
            log.warn("Task {} rejected by taskPipelineExecutor", taskId, exception);
            try {
                taskStore.fail(taskId, null, "系统繁忙，任务未能进入处理队列");
            } catch (RuntimeException updateException) {
                log.error("Failed to mark rejected task {} as FAILED", taskId, updateException);
            }
        }
    }
}
