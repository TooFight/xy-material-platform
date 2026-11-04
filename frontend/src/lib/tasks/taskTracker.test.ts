import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { TaskDTO } from "@/lib/types";
import { deferred, makeTask } from "@/test/fixtures";

import { createTaskEntry, type TaskEntry } from "./taskReducer";
import { createTaskTracker } from "./taskTracker";

const networkError = new ApiError({
  kind: "network",
  status: null,
  code: "NETWORK_ERROR",
  message: "网络连接失败",
});

function runningTask(id: number): TaskDTO {
  return makeTask(id, { status: "RUNNING", stage: "CHECKING" });
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("taskTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("上一轮全部请求结束后才安排下一轮", async () => {
    const taskA = runningTask(1);
    const taskB = runningTask(2);
    const firstA = deferred<TaskDTO>();
    const firstB = deferred<TaskDTO>();
    let round = 0;

    const fetchTask = vi.fn((taskId: number) => {
      round += 1;
      if (taskId === 1) {
        return firstA.promise;
      }
      return firstB.promise;
    });
    const tracker = createTaskTracker({
      fetchTask,
      onTaskSynced: () => undefined,
      onTaskSyncFailed: () => undefined,
      intervalMs: 1000,
    });

    tracker.setTasks([createTaskEntry(taskA), createTaskEntry(taskB)]);
    tracker.start();
    expect(fetchTask).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchTask).toHaveBeenCalledTimes(2);
    expect(round).toBe(2);

    firstA.resolve(runningTask(1));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    // B 还没结束，不能开始第二轮。
    expect(fetchTask).toHaveBeenCalledTimes(2);

    firstB.resolve(runningTask(2));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchTask).toHaveBeenCalledTimes(4);

    tracker.dispose();
  });

  it("任务进入终态后停止请求，所有任务终态时定时器数量为 0", async () => {
    const task = runningTask(1);
    const fetchTask = vi.fn().mockResolvedValue(
      makeTask(1, {
        status: "SUCCEEDED",
        stage: "FINALIZING",
        resultUrl: "/files/results/1.png",
      }),
    );
    const onTaskSynced = vi.fn();
    const tracker = createTaskTracker({
      fetchTask,
      onTaskSynced,
      onTaskSyncFailed: () => undefined,
      intervalMs: 1000,
    });

    tracker.setTasks([createTaskEntry(task)]);
    tracker.start();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(fetchTask).toHaveBeenCalledTimes(1);
    expect(onTaskSynced).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchTask).toHaveBeenCalledTimes(1);

    tracker.dispose();
  });

  it("连续失败达到上限后暂停，重新 setTasks 恢复后继续跟踪", async () => {
    const task = runningTask(1);
    const fetchTask = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(
        makeTask(1, {
          status: "SUCCEEDED",
          stage: "FINALIZING",
          resultUrl: "/files/results/1.png",
        }),
      );
    const onTaskSyncFailed = vi.fn();
    const onTaskSynced = vi.fn();
    let entry: TaskEntry = createTaskEntry(task);

    const tracker = createTaskTracker({
      fetchTask,
      onTaskSynced,
      onTaskSyncFailed,
      intervalMs: 100,
      maxConsecutiveErrors: 3,
    });

    tracker.setTasks([entry]);
    tracker.start();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await vi.advanceTimersByTimeAsync(100);
      await flushPromises();
    }

    expect(onTaskSyncFailed).toHaveBeenCalledTimes(3);
    expect(fetchTask).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchTask).toHaveBeenCalledTimes(3);

    // 模拟 Provider 处理 resume 后把未暂停的 entry 交回 tracker。
    entry = {
      ...entry,
      paused: false,
      syncError: null,
      consecutiveErrors: 0,
    };
    tracker.setTasks([entry]);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(fetchTask).toHaveBeenCalledTimes(4);
    expect(onTaskSynced).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    tracker.dispose();
  });

  it("dispose 中止进行中的请求，迟到响应不会回调", async () => {
    const task = runningTask(1);
    const captured: { signal: AbortSignal | null } = { signal: null };
    const pending = deferred<TaskDTO>();
    const onTaskSynced = vi.fn();
    const onTaskSyncFailed = vi.fn();
    const tracker = createTaskTracker({
      fetchTask: (_taskId, nextSignal) => {
        captured.signal = nextSignal;
        return pending.promise;
      },
      onTaskSynced,
      onTaskSyncFailed,
      intervalMs: 100,
    });

    tracker.setTasks([createTaskEntry(task)]);
    tracker.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(captured.signal).not.toBeNull();
    expect(captured.signal?.aborted).toBe(false);

    tracker.dispose();
    expect(captured.signal?.aborted).toBe(true);

    pending.resolve(makeTask(1, { status: "SUCCEEDED", stage: "FINALIZING" }));
    await flushPromises();

    expect(onTaskSynced).not.toHaveBeenCalled();
    expect(onTaskSyncFailed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("把所有任务改成终态后立即清除已安排的定时器", () => {
    const task = runningTask(1);
    const tracker = createTaskTracker({
      fetchTask: vi.fn(),
      onTaskSynced: () => undefined,
      onTaskSyncFailed: () => undefined,
      intervalMs: 1000,
    });

    tracker.setTasks([createTaskEntry(task)]);
    expect(vi.getTimerCount()).toBe(1);

    tracker.setTasks([
      createTaskEntry(makeTask(1, { status: "SUCCEEDED", stage: "FINALIZING" })),
    ]);
    expect(vi.getTimerCount()).toBe(0);

    tracker.dispose();
  });
});
