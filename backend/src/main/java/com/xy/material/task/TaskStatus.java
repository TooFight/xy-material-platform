package com.xy.material.task;

/**
 * 任务整体状态，取值与 docs/api.md §0.4 完全一致。
 */
public enum TaskStatus {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED;

    public boolean isTerminal() {
        return this == SUCCEEDED || this == FAILED;
    }
}
