package com.xy.material.task;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 按 CHECKING → GENERATING → FINALIZING 顺序执行。
 * 每个阶段开始/结束都通过独立事务落库；任何阶段失败后立即停止，不再执行后续阶段。
 */
@Component
public class TaskPipelineRunner {

    private static final Logger log = LoggerFactory.getLogger(TaskPipelineRunner.class);

    private final TaskMapper taskMapper;
    private final TaskStore taskStore;
    private final StageLogStore stageLogStore;
    private final Sleeper sleeper;
    private final Map<TaskStage, StageHandler> handlers;

    public TaskPipelineRunner(TaskMapper taskMapper,
                              TaskStore taskStore,
                              StageLogStore stageLogStore,
                              Sleeper sleeper,
                              List<StageHandler> stageHandlers) {
        this.taskMapper = taskMapper;
        this.taskStore = taskStore;
        this.stageLogStore = stageLogStore;
        this.sleeper = sleeper;

        EnumMap<TaskStage, StageHandler> map = new EnumMap<>(TaskStage.class);
        for (StageHandler handler : stageHandlers) {
            map.put(handler.stage(), handler);
        }
        if (map.size() != TaskStage.values().length) {
            throw new IllegalStateException("Missing stage handler: expected "
                    + TaskStage.values().length + " but got " + map.size());
        }
        this.handlers = Map.copyOf(map);
    }

    public void run(long taskId) {
        TaskRow task = taskMapper.findById(taskId).orElse(null);
        if (task == null) {
            log.warn("Task {} not found, skip pipeline", taskId);
            return;
        }
        if (task.isTerminal()) {
            log.debug("Task {} already terminal, skip pipeline", taskId);
            return;
        }

        StageContext context = new StageContext(task);
        for (TaskStage stage : TaskStage.values()) {
            if (!taskStore.enterStage(taskId, stage)) {
                log.debug("Task {} is terminal before stage {}, stop pipeline", taskId, stage);
                return;
            }

            try {
                stageLogStore.start(taskId, stage);
                sleeper.sleep(task.getSimStageDelayMs());
                if (stage.name().equals(task.getSimFailStage())) {
                    throw new SimulatedStageFailure(stage);
                }
                handlers.get(stage).execute(context);
                if (!stageLogStore.succeed(taskId, stage)) {
                    throw new StageExecutionException("阶段记录更新失败");
                }
            } catch (Exception exception) {
                if (exception instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                String reason = reasonOf(stage, exception);
                log.error("Task {} failed at stage {}: {}", taskId, stage, reason, exception);
                fail(taskId, stage, reason);
                return;
            }
        }

        if (context.getResultUrl() == null) {
            String reason = "结果整理失败：未生成结果文件";
            log.error("Task {} finished FINALIZING without resultUrl", taskId);
            fail(taskId, TaskStage.FINALIZING, reason);
            return;
        }
        if (!taskStore.succeed(taskId, context.getResultUrl())) {
            log.warn("Task {} was already terminal, resultUrl not saved", taskId);
        }
    }

    private void fail(long taskId, TaskStage stage, String reason) {
        try {
            stageLogStore.fail(taskId, stage, reason);
        } catch (Exception exception) {
            log.error("Failed to mark stage log FAILED for task {} stage {}", taskId, stage, exception);
        }
        try {
            taskStore.fail(taskId, stage, reason);
        } catch (Exception exception) {
            log.error("Failed to mark task FAILED for task {} stage {}", taskId, stage, exception);
        }
    }

    private static String reasonOf(TaskStage stage, Exception exception) {
        if (exception instanceof SimulatedStageFailure) {
            return "模拟" + stage.simulationLabel() + "失败：已按模拟配置在 "
                    + stage.name() + " 阶段中断";
        }
        if (exception instanceof StageExecutionException
                && exception.getMessage() != null
                && !exception.getMessage().isBlank()) {
            return exception.getMessage();
        }
        if (exception instanceof InterruptedException) {
            return "任务执行被中断";
        }
        return "阶段执行失败：" + stage.label() + "，请稍后重试";
    }
}
