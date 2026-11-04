import { isAbortError, toApiError, type ApiError } from "@/lib/api/client";
import type { TaskDTO } from "@/lib/types";

import { isTerminalStatus, type TaskEntry } from "./taskReducer";

export interface TaskTrackerTimers {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface TaskTrackerOptions {
  fetchTask: (taskId: number, signal: AbortSignal) => Promise<TaskDTO>;
  onTaskSynced: (task: TaskDTO) => void;
  onTaskSyncFailed: (taskId: number, error: ApiError) => void;
  intervalMs?: number;
  maxConsecutiveErrors?: number;
  timers?: TaskTrackerTimers;
}

export interface TaskTracker {
  /** 用 Provider 最新任务表同步 tracker 的轻量快照；会按需启停定时器。 */
  setTasks: (tasks: readonly TaskEntry[]) => void;
  start: () => void;
  dispose: () => void;
}

const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_MAX_CONSECUTIVE_ERRORS = 3;

const defaultTimers: TaskTrackerTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * 与 React 解耦的轮询调度器：
 * - 只跟踪 PENDING/RUNNING 且未暂停的任务；
 * - 每个任务独立 AbortController；
 * - 一轮全部结束后才 setTimeout 安排下一轮；
 * - 没有可跟踪任务时不保留定时器；
 * - dispose 后迟到响应不会触发任何回调。
 */
export function createTaskTracker(options: TaskTrackerOptions): TaskTracker {
  const intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  const maxConsecutiveErrors = Math.max(
    1,
    options.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE_ERRORS,
  );
  const timers = options.timers ?? defaultTimers;

  let tasks = new Map<number, TaskEntry>();
  let timer: unknown = null;
  let running = false;
  let disposed = false;
  const controllers = new Set<AbortController>();

  function activeTasks(): TaskEntry[] {
    return [...tasks.values()].filter(
      (entry) => !isTerminalStatus(entry.task.status) && !entry.paused,
    );
  }

  function clearTimer(): void {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(): void {
    if (disposed || running || timer !== null) {
      return;
    }
    if (activeTasks().length === 0) {
      return;
    }

    timer = timers.setTimeout(() => {
      timer = null;
      void runRound();
    }, intervalMs);
  }

  function reconcile(): void {
    if (disposed) {
      return;
    }
    if (activeTasks().length === 0) {
      clearTimer();
      return;
    }
    if (timer === null && !running) {
      schedule();
    }
  }

  function applySuccess(task: TaskDTO): void {
    const existing = tasks.get(task.id);
    if (!existing) {
      return;
    }
    if (isTerminalStatus(existing.task.status)) {
      // 迟到的非终态响应不能把本地快照改回非终态。
      tasks.set(task.id, {
        ...existing,
        syncError: null,
        consecutiveErrors: 0,
        paused: false,
      });
      return;
    }
    tasks.set(task.id, {
      ...existing,
      task,
      syncError: null,
      consecutiveErrors: 0,
      paused: false,
    });
  }

  function applyFailure(taskId: number, error: ApiError): void {
    const existing = tasks.get(taskId);
    if (!existing) {
      return;
    }
    const consecutiveErrors = existing.consecutiveErrors + 1;
    tasks.set(taskId, {
      ...existing,
      syncError: error,
      consecutiveErrors,
      paused: consecutiveErrors >= maxConsecutiveErrors,
    });
  }

  async function runRound(): Promise<void> {
    if (disposed || running) {
      return;
    }

    const roundTasks = activeTasks();
    if (roundTasks.length === 0) {
      return;
    }

    running = true;
    const requests = roundTasks.map((entry) => {
      const controller = new AbortController();
      controllers.add(controller);

      return options
        .fetchTask(entry.task.id, controller.signal)
        .then((task) => {
          if (disposed || controller.signal.aborted) {
            return;
          }
          applySuccess(task);
          try {
            options.onTaskSynced(task);
          } catch {
            // 展示层回调异常不应被当成查询失败。
          }
        })
        .catch((error: unknown) => {
          if (disposed || controller.signal.aborted || isAbortError(error)) {
            return;
          }
          const apiError = toApiError(error);
          applyFailure(entry.task.id, apiError);
          try {
            options.onTaskSyncFailed(entry.task.id, apiError);
          } catch {
            // 同上：回调异常不改变轮询生命周期。
          }
        })
        .finally(() => {
          controllers.delete(controller);
        });
    });

    try {
      await Promise.all(requests);
    } finally {
      running = false;
    }

    if (disposed) {
      return;
    }
    reconcile();
  }

  return {
    setTasks(nextTasks) {
      if (disposed) {
        return;
      }
      tasks = new Map(nextTasks.map((entry) => [entry.task.id, entry]));
      reconcile();
    },

    start() {
      reconcile();
    },

    dispose() {
      disposed = true;
      clearTimer();
      for (const controller of controllers) {
        controller.abort();
      }
      controllers.clear();
    },
  };
}
