"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isAbortError, toApiError, type ApiError } from "@/lib/api/client";
import { getTask, listTasks } from "@/lib/api/tasks";
import type { TaskDTO } from "@/lib/types";
import { useUser } from "@/lib/user/UserProvider";

import {
  createTasksState,
  isTerminalStatus,
  tasksReducer,
  type TaskEntry,
} from "./taskReducer";
import { createTaskTracker, type TaskTracker } from "./taskTracker";

export interface TaskContextValue {
  entries: TaskEntry[];
  byId: Record<number, TaskEntry>;
  activeCount: number;
  addTask: (task: TaskDTO) => void;
  /** 历史列表 / active 恢复把后端已有任务合并进任务表。 */
  upsertTask: (task: TaskDTO) => void;
  retry: (taskId: number) => void;
  isRestoring: boolean;
  restoreError: ApiError | null;
  retryRestore: () => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export interface TaskProviderProps {
  userId: number | null;
  children: ReactNode;
  /** 仅供测试注入更短的轮询间隔。 */
  intervalMs?: number;
  maxConsecutiveErrors?: number;
}

/**
 * 全局任务表。生产环境由 TaskProviderBoundary 用 key={userId} 重建，
 * 所以切换用户时任务表、追踪器和所有请求都会整体重置。
 */
export function TaskProvider({
  userId,
  children,
  intervalMs = 1500,
  maxConsecutiveErrors = 3,
}: TaskProviderProps) {
  const [state, dispatch] = useReducer(tasksReducer, createTasksState(userId ?? 0));
  const [isRestoring, setIsRestoring] = useState(userId !== null);
  const [restoreError, setRestoreError] = useState<ApiError | null>(null);
  const [restoreToken, setRestoreToken] = useState(0);
  const restoreRequestIdRef = useRef(0);
  const trackerRef = useRef<TaskTracker | null>(null);

  const entries = useMemo(() => {
    return state.order
      .map((taskId) => state.byId[taskId])
      .filter((entry): entry is TaskEntry => Boolean(entry));
  }, [state.order, state.byId]);

  const activeCount = useMemo(
    () => entries.filter((entry) => !isTerminalStatus(entry.task.status)).length,
    [entries],
  );

  // 刷新恢复：只拉未完成任务，随后交给 tracker 继续跟踪。
  // 每次重试递增 requestId；旧响应即使没被 abort 丢弃，也不能覆盖新一次恢复结果。
  useEffect(() => {
    if (userId === null) {
      return;
    }

    const controller = new AbortController();
    const requestId = restoreRequestIdRef.current + 1;
    restoreRequestIdRef.current = requestId;
    let active = true;

    listTasks({ userId, active: true, signal: controller.signal })
      .then((response) => {
        if (
          !active ||
          controller.signal.aborted ||
          requestId !== restoreRequestIdRef.current
        ) {
          return;
        }
        for (const task of response.items) {
          dispatch({ type: "upsert", userId, task });
        }
        setIsRestoring(false);
        setRestoreError(null);
      })
      .catch((error: unknown) => {
        if (
          !active ||
          controller.signal.aborted ||
          isAbortError(error) ||
          requestId !== restoreRequestIdRef.current
        ) {
          return;
        }
        setRestoreError(toApiError(error));
        setIsRestoring(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, restoreToken]);

  // 一个用户对应一个 tracker；Provider 卸载/切换用户时 dispose。
  useEffect(() => {
    if (userId === null) {
      return;
    }

    const tracker = createTaskTracker({
      fetchTask: (taskId, signal) => getTask({ taskId, userId, signal }),
      onTaskSynced: (task) => dispatch({ type: "syncSucceeded", userId, task }),
      onTaskSyncFailed: (taskId, error) =>
        dispatch({
          type: "syncFailed",
          userId,
          taskId,
          error,
          maxConsecutiveErrors,
        }),
      intervalMs,
      maxConsecutiveErrors,
    });

    trackerRef.current = tracker;
    tracker.start();

    return () => {
      tracker.dispose();
      trackerRef.current = null;
    };
  }, [userId, intervalMs, maxConsecutiveErrors]);

  // 任务表每次变化都让 tracker 重新评估：新任务自动开始，全部终态时清除定时器。
  useEffect(() => {
    trackerRef.current?.setTasks(entries);
  }, [entries]);

  const addTask = useCallback(
    (task: TaskDTO) => {
      if (userId === null) {
        return;
      }
      dispatch({ type: "upsert", userId, task });
    },
    [userId],
  );

  const retry = useCallback(
    (taskId: number) => {
      if (userId === null) {
        return;
      }
      dispatch({ type: "resume", userId, taskId });
    },
    [userId],
  );

  const retryRestore = useCallback(() => {
    if (userId === null) {
      return;
    }
    // 立即作废旧恢复请求；即使它在新 effect 启动前返回，也不能写入。
    restoreRequestIdRef.current += 1;
    setIsRestoring(true);
    setRestoreToken((token) => token + 1);
  }, [userId]);

  const value = useMemo<TaskContextValue>(
    () => ({
      entries,
      byId: state.byId,
      activeCount,
      addTask,
      upsertTask: addTask,
      retry,
      isRestoring,
      restoreError,
      retryRestore,
    }),
    [
      entries,
      state.byId,
      activeCount,
      addTask,
      retry,
      isRestoring,
      restoreError,
      retryRestore,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

/** 读取 UserProvider，把 userId 作为 key 重建任务 Provider。 */
export function TaskProviderBoundary({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  return (
    <TaskProvider key={userId ?? "anonymous"} userId={userId}>
      {children}
    </TaskProvider>
  );
}

export function useTasks(): TaskContextValue {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTasks 必须在 TaskProvider 内使用");
  }
  return context;
}
