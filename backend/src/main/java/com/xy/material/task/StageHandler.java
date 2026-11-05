package com.xy.material.task;

/**
 * 单个阶段的真实执行逻辑。
 */
public interface StageHandler {

    TaskStage stage();

    void execute(StageContext context) throws Exception;
}
