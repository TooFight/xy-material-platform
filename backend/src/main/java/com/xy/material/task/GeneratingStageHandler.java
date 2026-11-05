package com.xy.material.task;

import org.springframework.stereotype.Component;

/**
 * GENERATING：模拟耗时后得到一个“生成产物标识”（模板预置的示例结果图路径）。
 */
@Component
public class GeneratingStageHandler implements StageHandler {

    @Override
    public TaskStage stage() {
        return TaskStage.GENERATING;
    }

    @Override
    public void execute(StageContext context) {
        String sampleResultPath = context.getTask().getSampleResultPath();
        if (sampleResultPath == null || sampleResultPath.isBlank()) {
            throw new StageExecutionException("模拟生成失败：模板示例结果图未配置");
        }
        context.setProductIdentifier(sampleResultPath);
    }
}
