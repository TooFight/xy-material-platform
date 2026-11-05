package com.xy.material.task;

/**
 * 任务事务提交后发布，由 AFTER_COMMIT 监听器投递到线程池。
 */
public record TaskAcceptedEvent(long taskId) {
}
