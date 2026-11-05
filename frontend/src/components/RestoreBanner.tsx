"use client";

import { useTasks } from "@/lib/tasks/TaskProvider";

import styles from "./RestoreBanner.module.css";

/**
 * 未完成任务恢复失败时的全局提示。
 * 重新加载期间保留错误文案，按钮改为加载中并禁用，避免重复请求。
 */
export function RestoreBanner() {
  const { restoreError, retryRestore, isRestoring } = useTasks();

  if (!restoreError) {
    return null;
  }

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.message}>
        未完成任务恢复失败：{restoreError.message}
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={retryRestore}
        disabled={isRestoring}
      >
        {isRestoring ? "重新加载中…" : "重新加载"}
      </button>
    </div>
  );
}
