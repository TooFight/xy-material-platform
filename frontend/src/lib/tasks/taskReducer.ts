import type { ApiError } from "@/lib/api/client";
import type { TaskDTO, TaskStage, TaskStatus } from "@/lib/types";

export interface TaskEntry {
  task: TaskDTO;
  syncError: ApiError | null;
  consecutiveErrors: number;
  paused: boolean;
}

export interface TasksState {
  userId: number;
  byId: Record<number, TaskEntry>;
  order: number[];
}

export type TasksAction =
  | { type: "upsert"; userId: number; task: TaskDTO }
  | { type: "syncSucceeded"; userId: number; task: TaskDTO }
  | {
      type: "syncFailed";
      userId: number;
      taskId: number;
      error: ApiError;
      maxConsecutiveErrors: number;
    }
  | { type: "resume"; userId: number; taskId: number }
  | { type: "resetForUser"; userId: number };

const STAGE_RANK: Record<TaskStage, number> = {
  CHECKING: 1,
  GENERATING: 2,
  FINALIZING: 3,
};

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "SUCCEEDED" || status === "FAILED";
}

export function createTaskEntry(task: TaskDTO): TaskEntry {
  return {
    task,
    syncError: null,
    consecutiveErrors: 0,
    paused: false,
  };
}

export function createTasksState(userId: number): TasksState {
  return {
    userId,
    byId: {},
    order: [],
  };
}

/**
 * 任务进度只允许向前：
 * - 终态任务不会被任何新数据覆盖；
 * - 非终态数据不能把 RUNNING/FINALIZING 回退到更早的阶段。
 */
function progressRank(task: TaskDTO): number {
  if (task.status === "PENDING") {
    return 0;
  }
  if (task.status === "RUNNING") {
    return 1 + (task.stage ? STAGE_RANK[task.stage] : 0);
  }
  return 10;
}

function shouldReplaceTask(existing: TaskDTO, incoming: TaskDTO): boolean {
  if (isTerminalStatus(existing.status)) {
    return false;
  }
  if (isTerminalStatus(incoming.status)) {
    return true;
  }
  return progressRank(incoming) >= progressRank(existing);
}

function sortOrder(byId: Record<number, TaskEntry>): number[] {
  return Object.keys(byId)
    .map(Number)
    .sort((leftId, rightId) => {
      const leftTime = Date.parse(byId[leftId].task.createdAt);
      const rightTime = Date.parse(byId[rightId].task.createdAt);
      const leftValid = Number.isFinite(leftTime);
      const rightValid = Number.isFinite(rightTime);

      if (leftValid && rightValid && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      if (leftValid !== rightValid) {
        return leftValid ? -1 : 1;
      }
      return rightId - leftId;
    });
}

function mergeTask(state: TasksState, task: TaskDTO): TasksState {
  const existing = state.byId[task.id];
  const entry: TaskEntry = existing
    ? {
        ...existing,
        task: shouldReplaceTask(existing.task, task) ? task : existing.task,
        syncError: null,
        consecutiveErrors: 0,
        paused: false,
      }
    : createTaskEntry(task);

  const byId = {
    ...state.byId,
    [task.id]: entry,
  };

  return {
    ...state,
    byId,
    order: sortOrder(byId),
  };
}

/**
 * 纯函数任务表。任何 action 都带 userId；除了 resetForUser，userId 不匹配直接丢弃。
 * 查询失败只写 syncError/计数，task.status 永远保持原值。
 */
export function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  if (action.type === "resetForUser") {
    return createTasksState(action.userId);
  }

  if (action.userId !== state.userId) {
    return state;
  }

  switch (action.type) {
    case "upsert":
    case "syncSucceeded":
      return mergeTask(state, action.task);

    case "syncFailed": {
      const existing = state.byId[action.taskId];
      if (!existing) {
        return state;
      }

      const consecutiveErrors = existing.consecutiveErrors + 1;
      const maxErrors = Math.max(1, action.maxConsecutiveErrors);

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.taskId]: {
            ...existing,
            syncError: action.error,
            consecutiveErrors,
            paused: consecutiveErrors >= maxErrors,
          },
        },
      };
    }

    case "resume": {
      const existing = state.byId[action.taskId];
      if (!existing) {
        return state;
      }

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.taskId]: {
            ...existing,
            syncError: null,
            consecutiveErrors: 0,
            paused: false,
          },
        },
      };
    }

    default:
      return state;
  }
}
