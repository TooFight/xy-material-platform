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

import { CloseIcon, RefreshIcon } from "./icons";
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
    // 兼容旧数据：failedStage 缺失时，stage 表示中断发生时所处的阶段。
    const failedIndex = stageIndex(task.failedStage ?? task.stage);
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
  if (task.stage) {
    return `中断于${TASK_STAGE_LABELS[task.stage]}`;
  }
  return "任务尚未开始执行。";
}

export interface TaskCardProps {
  entry: TaskEntry;
  onRetry: (taskId: number) => void;
}

/**
 * 竖版任务卡（UI-03 的 History 卡片）：成功时整卡显示结果图，其余状态在卡片中部显示状态与原因。
 * 「查询异常」（琥珀色，可重新查询）与「任务失败」（红色，来自后端）在视觉和文案上分开。
 */
export function TaskCard({ entry, onRetry }: TaskCardProps) {
  const { task, syncError } = entry;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = `task-title-${task.id}`;
  const previewTitleId = `task-preview-title-${task.id}`;
  const resultUrl = task.status === "SUCCEEDED" ? task.resultUrl : null;

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
    <article
      className={styles.card}
      data-status={task.status}
      data-has-result={resultUrl ? "true" : undefined}
      aria-labelledby={titleId}
    >
      {resultUrl && (
        <button
          ref={triggerRef}
          type="button"
          className={styles.thumbnail}
          onClick={openPreview}
          aria-label={`查看${task.templateTitle}结果大图`}
        >
          {/* 结果图完整显示在中间，上下用同一张图的模糊放大版填满竖版卡片。 */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 装饰性模糊底图。 */}
          <img className={styles.thumbnailBackdrop} src={assetUrl(resultUrl)} alt="" loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element -- 结果图来自后端运行时地址，无法预配置 next/image remotePatterns。 */}
          <img className={styles.thumbnailImage} src={assetUrl(resultUrl)} alt="" loading="lazy" />
          <span className={styles.thumbnailHint}>查看结果</span>
        </button>
      )}

      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            {task.templateTitle}
          </h3>
          <time className={styles.time} dateTime={task.createdAt}>
            {formatTaskTime(task.createdAt)}
          </time>
        </div>
        {resultUrl && <span className={styles.doneChip}>{TASK_STATUS_LABELS[task.status]}</span>}
      </header>

      {!resultUrl && (
        <div className={styles.center}>
          {task.status === "FAILED" ? (
            <div className={styles.failure} role="status">
              <strong>
                {task.failedStage
                  ? `任务失败（${TASK_STAGE_LABELS[task.failedStage]}）`
                  : task.stage
                    ? `任务中断于${TASK_STAGE_LABELS[task.stage]}`
                    : "任务失败"}
              </strong>
              <p>{task.failureReason ?? "任务执行失败，请稍后重试。"}</p>
            </div>
          ) : (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <span className={styles.statusText}>{TASK_STATUS_LABELS[task.status]}</span>
            </>
          )}
          <p className={styles.stageLine}>{stageLine(entry)}</p>
        </div>
      )}

      <div className={styles.footer}>
        {syncError && (
          <div className={styles.syncWarning} role="status">
            <strong>状态暂时无法获取，已保留上次结果</strong>
            <p>{syncError.message}</p>
            {entry.paused && <p className={styles.pausedHint}>自动查询已暂停，请手动重新查询。</p>}
          </div>
        )}

        <ol className={resultUrl ? "srOnly" : styles.steps} aria-label="处理阶段">
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
                <span className={styles.stepBar} aria-hidden="true" />
                <span className={styles.stepName}>{TASK_STAGE_LABELS[stage]}</span>
                <span className="srOnly">{STEP_STATE_LABELS[state]}</span>
              </li>
            );
          })}
        </ol>

        {syncError && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => onRetry(task.id)}
              aria-label="重新查询"
              title="重新查询"
            >
              <RefreshIcon size={15} />
            </button>
          </div>
        )}
      </div>

      {resultUrl && (
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
                <CloseIcon size={18} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- 同上。 */}
            <img
              className={styles.dialogImage}
              src={assetUrl(resultUrl)}
              alt={`${task.templateTitle}制作结果`}
            />
          </div>
        </dialog>
      )}
    </article>
  );
}
