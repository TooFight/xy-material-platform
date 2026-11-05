package com.xy.material.task;

/**
 * 可预期的阶段失败，message 直接作为用户可读的 failure_reason。
 */
public class StageExecutionException extends RuntimeException {

    public StageExecutionException(String message) {
        super(message);
    }
}
