"use client";

import { useRef } from "react";

import { assetUrl } from "@/lib/api/client";
import type { TaskStage } from "@/lib/types";
import {
  TASK_STAGES,
  TASK_STAGE_LABELS,
  TASK_STATUS_LABELS,
  formatTaskTime,
  stageIndex,
} from "@/lib/tasks/taskFormat";
import type { TaskEntry } from "@/lib/tasks/taskReducer";

import styles from "./TaskCard.module.css";

type StepState = "completed" | "current" | "failed" | "skipped" | "pending";

const STEP_STATE_LABELS: Record<StepState, string> = {
  completed: "已完成",
  current: "进行中",
  failed: "失败",
  skipped: "未执行",
  pending: "未开始",
};

function getStepState(entry: TaskEntry, index: number): StepState {
  const { task } = entry;
  if (task.status === "SUCCEEDED") {
    return "completed";
  }

  if (task.status === "FAILED") {
    const failedIndex = stageIndex(task.failedStage);
    if (failedIndex < 0) {
      return "pending";
    }
    if (index < failedIndex) {
      return "completed";
    }
    if (index === failedIndex) {
      return "failed";
    }
    return "skipped";
  }

  if (task.status === "RUNNING") {
    const currentIndex = stageIndex(task.stage);
    if (currentIndex < 0) {
      return "pending";
    }
    if (index < currentIndex) {
      return "completed";
    }
    if (index === currentIndex) {
      return "current";
    }
    return "pending";
  }

  return "pending";
}

function stepDot(state: StepState, index: number): string {
  if (state === "completed") {
    return "✓";
  }
  if (state === "failed") {
    return "×";
  }
  if (state === "skipped") {
    return "—";
  }
  return String(index + 1);
}

function stageLine(entry: TaskEntry): string {
  const { task } = entry;
  if (task.status === "PENDING") {
    return "排队等待后台处理。";
  }
  if (task.status === "RUNNING") {
    return task.stage ? `当前阶段：${TASK_STAGE_LABELS[task.stage]}` : "正在进入处理阶段。";
  }
  if (task.status === "SUCCEEDED") {
    return "三阶段处理已完成。";
  }
  if (task.failedStage) {
    return `失败阶段：${TASK_STAGE_LABELS[task.failedStage]}`;
  }
  return "任务尚未开始执行。";
}

export interface TaskCardProps {
  entry: TaskEntry;
  onRetry: (taskId: number) => void;
}

export function TaskCard({ entry, onRetry }: TaskCardProps) {
  const { task, syncError } = entry;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = `task-title-${task.id}`;
  const previewTitleId = `task-preview-title-${task.id}`;

  const openPreview = () => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  };

  const closePreview = () => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      triggerRef.current?.focus();
    }
  };

  const handleDialogClose = () => {
    triggerRef.current?.focus();
  };

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            {task.templateTitle}
          </h3>
          <time className={styles.time} dateTime={task.createdAt}>
            {formatTaskTime(task.createdAt)}
          </time>
        </div>
        <span className={styles.status} data-status={task.status}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </header>

      <p className={styles.stageLine}>{stageLine(entry)}</p>

      <ol className={styles.steps} aria-label="处理阶段">
        {TASK_STAGES.map((stage: TaskStage, index) => {
          const state = getStepState(entry, index);
          return (
            <li
              key={stage}
              className={styles.step}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`${TASK_STAGE_LABELS[stage]}：${STEP_STATE_LABELS[state]}`}
            >
              <span className={styles.stepDot} aria-hidden="true">
                {stepDot(state, index)}
              </span>
              <span className={styles.stepName}>{TASK_STAGE_LABELS[stage]}</span>
              <span className={styles.stepState}>{STEP_STATE_LABELS[state]}</span>
            </li>
          );
        })}
      </ol>

      {syncError && (
        <div className={styles.syncWarning} role="status">
          <div>
            <strong>状态暂时无法获取，已保留上次结果</strong>
            <p>{syncError.message}</p>
            {entry.paused && <p className={styles.pausedHint}>自动查询已暂停，请手动重新查询。</p>}
          </div>
          <button type="button" className={styles.retryButton} onClick={() => onRetry(task.id)}>
            重新查询
          </button>
        </div>
      )}

      {task.status === "FAILED" && (
        <div className={styles.failure} role="status">
          <strong>
            任务失败{task.failedStage ? `（${TASK_STAGE_LABELS[task.failedStage]}）` : ""}
          </strong>
          <p>{task.failureReason ?? "任务执行失败，请稍后重试。"}</p>
        </div>
      )}

      {task.status === "SUCCEEDED" && task.resultUrl && (
        <>
          <button
            ref={triggerRef}
            type="button"
            className={styles.thumbnail}
            onClick={openPreview}
            aria-label={`查看${task.templateTitle}结果大图`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 结果图来自后端运行时地址，无法预配置 next/image remotePatterns。 */}
            <img src={assetUrl(task.resultUrl)} alt="" loading="lazy" />
            <span>查看结果</span>
          </button>

          <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-labelledby={previewTitleId}
            onClose={handleDialogClose}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closePreview();
              }
            }}
          >
            <div className={styles.dialogInner}>
              <div className={styles.dialogHeader}>
                <h3 id={previewTitleId}>{task.templateTitle} · 制作结果</h3>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={closePreview}
                  aria-label="关闭结果预览"
                >
                  ×
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- 同上。 */}
              <img
                className={styles.dialogImage}
                src={assetUrl(task.resultUrl)}
                alt={`${task.templateTitle}制作结果`}
              />
            </div>
          </dialog>
        </>
      )}
    </article>
  );
}
