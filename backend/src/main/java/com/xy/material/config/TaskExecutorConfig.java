package com.xy.material.config;

import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 独立的有界任务流水线线程池；队列满时由 TaskDispatcher 捕获 TaskRejectedException。
 */
@Configuration
public class TaskExecutorConfig {

    public static final String TASK_PIPELINE_EXECUTOR = "taskPipelineExecutor";

    @Bean(name = TASK_PIPELINE_EXECUTOR)
    public ThreadPoolTaskExecutor taskPipelineExecutor(TaskExecutorProperties properties) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(properties.coreSize());
        executor.setMaxPoolSize(properties.maxSize());
        executor.setQueueCapacity(properties.queueCapacity());
        executor.setThreadNamePrefix("task-pipeline-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }
}
