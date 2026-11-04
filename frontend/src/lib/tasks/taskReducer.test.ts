import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { TaskDTO } from "@/lib/types";
import { makeTask } from "@/test/fixtures";

import {
  createTasksState,
  isTerminalStatus,
  tasksReducer,
  type TasksState,
} from "./taskReducer";

const networkError = new ApiError({
  kind: "network",
  status: null,
  code: "NETWORK_ERROR",
  message: "网络连接失败",
});

function runningTask(id: number, stage: "CHECKING" | "GENERATING" | "FINALIZING" = "CHECKING") {
  return makeTask(id, {
    status: "RUNNING",
    stage,
    startedAt: "2026-11-04T08:30:20.000Z",
  });
}

function upsert(state: TasksState, task: TaskDTO, userId = 1): TasksState {
  return tasksReducer(state, { type: "upsert", userId, task });
}

describe("tasksReducer", () => {
  it("按任务 ID 隔离：更新一个任务不影响另一个任务", () => {
    let state = createTasksState(1);
    state = upsert(state, runningTask(1, "CHECKING"));
    state = upsert(state, runningTask(2, "GENERATING"));

    state = upsert(
      state,
      makeTask(1, {
        status: "SUCCEEDED",
        stage: "FINALIZING",
        resultUrl: "/files/results/1.png",
      }),
    );

    expect(state.byId[1].task.status).toBe("SUCCEEDED");
    expect(state.byId[1].task.resultUrl).toBe("/files/results/1.png");
    expect(state.byId[2].task.status).toBe("RUNNING");
    expect(state.byId[2].task.stage).toBe("GENERATING");
  });

  it("查询失败只写 syncError 和计数，绝不把任务改成 FAILED", () => {
    let state = createTasksState(1);
    state = upsert(state, runningTask(1, "GENERATING"));
    state = upsert(state, runningTask(2, "CHECKING"));

    state = tasksReducer(state, {
      type: "syncFailed",
      userId: 1,
      taskId: 1,
      error: networkError,
      maxConsecutiveErrors: 3,
    });

    expect(state.byId[1].task.status).toBe("RUNNING");
    expect(state.byId[1].task.stage).toBe("GENERATING");
    expect(state.byId[1].syncError).toBe(networkError);
    expect(state.byId[1].consecutiveErrors).toBe(1);
    expect(state.byId[1].paused).toBe(false);

    // 另一个任务完全不受影响。
    expect(state.byId[2].syncError).toBeNull();
    expect(state.byId[2].consecutiveErrors).toBe(0);
    expect(state.byId[2].task.status).toBe("RUNNING");
  });

  it("连续失败达到上限后暂停，resume 清空错误并恢复", () => {
    let state = createTasksState(1);
    state = upsert(state, runningTask(1));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      state = tasksReducer(state, {
        type: "syncFailed",
        userId: 1,
        taskId: 1,
        error: networkError,
        maxConsecutiveErrors: 3,
      });
    }

    expect(state.byId[1].consecutiveErrors).toBe(3);
    expect(state.byId[1].paused).toBe(true);
    expect(state.byId[1].task.status).toBe("RUNNING");

    state = tasksReducer(state, { type: "resume", userId: 1, taskId: 1 });

    expect(state.byId[1].paused).toBe(false);
    expect(state.byId[1].syncError).toBeNull();
    expect(state.byId[1].consecutiveErrors).toBe(0);
    expect(state.byId[1].task.status).toBe("RUNNING");
  });

  it("syncSucceeded 清空错误并合并最新任务数据", () => {
    let state = createTasksState(1);
    state = upsert(state, runningTask(1, "CHECKING"));
    state = tasksReducer(state, {
      type: "syncFailed",
      userId: 1,
      taskId: 1,
      error: networkError,
      maxConsecutiveErrors: 3,
    });

    const succeeded = makeTask(1, {
      status: "SUCCEEDED",
      stage: "FINALIZING",
      resultUrl: "/files/results/1.png",
    });
    state = tasksReducer(state, { type: "syncSucceeded", userId: 1, task: succeeded });

    expect(state.byId[1].task).toBe(succeeded);
    expect(state.byId[1].syncError).toBeNull();
    expect(state.byId[1].consecutiveErrors).toBe(0);
    expect(state.byId[1].paused).toBe(false);
  });

  it("旧的非终态响应不会覆盖已经是终态的任务", () => {
    let state = createTasksState(1);
    const succeeded = makeTask(1, {
      status: "SUCCEEDED",
      stage: "FINALIZING",
      resultUrl: "/files/results/1.png",
    });
    state = upsert(state, succeeded);

    state = upsert(state, runningTask(1, "GENERATING"));

    expect(state.byId[1].task.status).toBe("SUCCEEDED");
    expect(state.byId[1].task.stage).toBe("FINALIZING");
    expect(state.byId[1].task.resultUrl).toBe("/files/results/1.png");

    const failed = makeTask(2, {
      status: "FAILED",
      stage: "CHECKING",
      failedStage: "CHECKING",
      failureReason: "模拟检查失败",
    });
    state = upsert(state, failed);
    state = upsert(state, runningTask(2, "GENERATING"));

    expect(state.byId[2].task.status).toBe("FAILED");
    expect(state.byId[2].task.failureReason).toBe("模拟检查失败");
  });

  it("非终态阶段不会回退（GENERATING 不会被 CHECKING 覆盖）", () => {
    let state = createTasksState(1);
    state = upsert(state, runningTask(1, "GENERATING"));
    state = upsert(state, runningTask(1, "CHECKING"));

    expect(state.byId[1].task.stage).toBe("GENERATING");
  });

  it("userId 不匹配的 action 全部丢弃，resetForUser 才能切换用户", () => {
    let state = createTasksState(1);
    state = upsert(state, runningTask(1));

    const wrongUserUpsert = upsert(state, runningTask(2), 2);
    expect(wrongUserUpsert).toBe(state);

    const wrongUserFailure = tasksReducer(state, {
      type: "syncFailed",
      userId: 2,
      taskId: 1,
      error: networkError,
      maxConsecutiveErrors: 3,
    });
    expect(wrongUserFailure).toBe(state);

    const wrongUserResume = tasksReducer(state, { type: "resume", userId: 2, taskId: 1 });
    expect(wrongUserResume).toBe(state);

    const reset = tasksReducer(state, { type: "resetForUser", userId: 2 });
    expect(reset.userId).toBe(2);
    expect(reset.order).toEqual([]);
    expect(reset.byId).toEqual({});
  });

  it("order 按 createdAt 倒序排列，同时间按 ID 倒序", () => {
    let state = createTasksState(1);
    state = upsert(
      state,
      makeTask(1, { createdAt: "2026-11-04T08:30:15.000Z" }),
    );
    state = upsert(
      state,
      makeTask(3, { createdAt: "2026-11-04T08:32:15.000Z" }),
    );
    state = upsert(
      state,
      makeTask(2, { createdAt: "2026-11-04T08:31:15.000Z" }),
    );

    expect(state.order).toEqual([3, 2, 1]);

    state = upsert(
      state,
      makeTask(4, { createdAt: "2026-11-04T08:32:15.000Z" }),
    );
    expect(state.order).toEqual([4, 3, 2, 1]);
  });

  it("isTerminalStatus 只把 SUCCEEDED / FAILED 视为终态", () => {
    expect(isTerminalStatus("PENDING")).toBe(false);
    expect(isTerminalStatus("RUNNING")).toBe(false);
    expect(isTerminalStatus("SUCCEEDED")).toBe(true);
    expect(isTerminalStatus("FAILED")).toBe(true);
  });
});
