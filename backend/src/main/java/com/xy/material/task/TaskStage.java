package com.xy.material.task;

/**
 * 任务阶段，取值与 docs/api.md §0.4 完全一致。
 */
public enum TaskStage {
    CHECKING("素材检查", "素材检查"),
    GENERATING("模拟生成", "生成"),
    FINALIZING("结果整理", "结果整理");

    private final String label;
    private final String simulationLabel;

    TaskStage(String label, String simulationLabel) {
        this.label = label;
        this.simulationLabel = simulationLabel;
    }

    public String label() {
        return label;
    }

    /**
     * 用于“模拟{label}失败”文案，避免 GENERATING 的 label 本身已含“模拟”而重复。
     */
    public String simulationLabel() {
        return simulationLabel;
    }
}
