import type { TaskStage, TaskStatus } from "@/lib/types";

export const TASK_STAGES: readonly TaskStage[] = ["CHECKING", "GENERATING", "FINALIZING"];

export const TASK_STAGE_LABELS: Record<TaskStage, string> = {
  CHECKING: "素材检查",
  GENERATING: "模拟生成",
  FINALIZING: "结果整理",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "等待处理",
  RUNNING: "处理中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

export function stageIndex(stage: TaskStage | null): number {
  if (!stage) {
    return -1;
  }
  return TASK_STAGES.indexOf(stage);
}

/** 历史页要求按浏览器本地时区显示。 */
export function formatTaskTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
