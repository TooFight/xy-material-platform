package com.xy.material.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 任务流水线线程池参数，默认 core=2 / max=2 / queue=100。
 */
@ConfigurationProperties(prefix = "app.task-executor")
public record TaskExecutorProperties(Integer coreSize, Integer maxSize, Integer queueCapacity) {

    public TaskExecutorProperties {
        if (coreSize == null) {
            coreSize = 2;
        }
        if (maxSize == null) {
            maxSize = 2;
        }
        if (queueCapacity == null) {
            queueCapacity = 100;
        }
        if (coreSize < 1) {
            throw new IllegalArgumentException("app.task-executor.core-size must be >= 1");
        }
        if (maxSize < coreSize) {
            throw new IllegalArgumentException("app.task-executor.max-size must be >= core-size");
        }
        if (queueCapacity < 0) {
            throw new IllegalArgumentException("app.task-executor.queue-capacity must be >= 0");
        }
    }
}
