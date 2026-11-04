import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskProvider, useTasks } from "./TaskProvider";
import { jsonResponse, makeTask, installFetch, deferred } from "@/test/fixtures";

function Probe() {
  const { entries, activeCount, addTask, retry, isRestoring, restoreError } = useTasks();
  return (
    <div>
      <span data-testid="restoring">{isRestoring ? "restoring" : "ready"}</span>
      <span data-testid="count">{activeCount}</span>
      <span data-testid="restore-error">{restoreError?.message ?? "none"}</span>
      <ul>
        {entries.map((entry) => (
          <li key={entry.task.id} data-testid={`task-${entry.task.id}`}>
            {entry.task.status}|{entry.task.stage ?? "null"}|
            {entry.syncError?.message ?? "no-sync-error"}|{entry.paused ? "paused" : "active"}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => addTask(makeTask(1))}>
        add
      </button>
      <button type="button" onClick={() => retry(1)}>
        retry
      </button>
    </div>
  );
}

const running = makeTask(1, {
  status: "RUNNING",
  stage: "CHECKING",
  startedAt: "2026-11-04T08:30:20.000Z",
});
const succeeded = makeTask(1, {
  status: "SUCCEEDED",
  stage: "FINALIZING",
  resultUrl: "/files/results/1.png",
});

describe("TaskProvider", () => {
  it("刷新恢复：挂载后用 active=true 返回的任务开始跟踪直到终态", async () => {
    let activeHeader: string | null = null;
    installFetch((url, init) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        activeHeader = new Headers(init?.headers).get("X-User-Id");
        return Promise.resolve(jsonResponse({ items: [running] }));
      }
      if (url.pathname === "/api/tasks/1") {
        return Promise.resolve(jsonResponse(succeeded));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    render(
      <TaskProvider userId={1} intervalMs={25}>
        <Probe />
      </TaskProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("restoring")).toHaveTextContent("ready"));
    await waitFor(() =>
      expect(screen.getByTestId("task-1")).toHaveTextContent("SUCCEEDED"),
    );

    expect(activeHeader).toBe("1");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("查询异常不等于任务失败：网络/503 保留 RUNNING 和 syncError，恢复后更新到 SUCCEEDED", async () => {
    let attempts = 0;
    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [running] }));
      }
      if (url.pathname === "/api/tasks/1") {
        attempts += 1;
        if (attempts <= 2) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "状态服务暂时不可用" },
              { status: 503 },
            ),
          );
        }
        return Promise.resolve(jsonResponse(succeeded));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    render(
      <TaskProvider userId={1} intervalMs={20}>
        <Probe />
      </TaskProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("task-1")).toHaveTextContent("状态服务暂时不可用"),
    );
    expect(screen.getByTestId("task-1")).toHaveTextContent("RUNNING");
    expect(screen.getByTestId("task-1")).toHaveTextContent("active");

    await waitFor(() =>
      expect(screen.getByTestId("task-1")).toHaveTextContent("SUCCEEDED"),
    );
    expect(screen.getByTestId("task-1")).toHaveTextContent("no-sync-error");
    expect(attempts).toBeGreaterThanOrEqual(3);
  });

  it("连续失败后暂停跟踪，手动 retry 后恢复查询并到达终态", async () => {
    let attempts = 0;
    let recovered = false;
    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [running] }));
      }
      if (url.pathname === "/api/tasks/1") {
        attempts += 1;
        if (!recovered) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "状态服务暂时不可用" },
              { status: 503 },
            ),
          );
        }
        return Promise.resolve(jsonResponse(succeeded));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    render(
      <TaskProvider userId={1} intervalMs={15}>
        <Probe />
      </TaskProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("task-1")).toHaveTextContent("paused"), {
      timeout: 2000,
    });
    expect(attempts).toBe(3);

    const attemptsAfterPause = attempts;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(attempts).toBe(attemptsAfterPause);

    recovered = true;
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() =>
      expect(screen.getByTestId("task-1")).toHaveTextContent("SUCCEEDED"),
    );
    expect(attempts).toBe(attemptsAfterPause + 1);
  });

  it("addTask 后自动开始跟踪新任务", async () => {
    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks/1") {
        return Promise.resolve(jsonResponse(succeeded));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    render(
      <TaskProvider userId={1} intervalMs={20}>
        <Probe />
      </TaskProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("restoring")).toHaveTextContent("ready"));
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() =>
      expect(screen.getByTestId("task-1")).toHaveTextContent("SUCCEEDED"),
    );
  });

  it("切换用户 key 重建：旧请求被中止，旧用户迟到响应不进入新 state", async () => {
    const oldSignal = { value: null as AbortSignal | null };
    const oldRequest = deferred<Response>();
    const task1 = makeTask(1);
    const task2 = makeTask(2, {
      status: "PENDING",
      createdAt: "2026-11-04T09:00:00.000Z",
    });
    const task2Done = makeTask(2, {
      status: "SUCCEEDED",
      stage: "FINALIZING",
      resultUrl: "/files/results/2.png",
      createdAt: "2026-11-04T09:00:00.000Z",
    });
    let oldCalled = false;

    installFetch((url, init) => {
      const userId = new Headers(init?.headers).get("X-User-Id");
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(
          jsonResponse({ items: userId === "1" ? [task1] : [task2] }),
        );
      }
      if (url.pathname === "/api/tasks/1") {
        oldCalled = true;
        oldSignal.value = init?.signal ?? null;
        return oldRequest.promise;
      }
      if (url.pathname === "/api/tasks/2") {
        return Promise.resolve(jsonResponse(task2Done));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    const { rerender } = render(
      <TaskProvider userId={1} intervalMs={20}>
        <Probe />
      </TaskProvider>,
    );

    await waitFor(() => expect(oldCalled).toBe(true));
    expect(screen.getByTestId("task-1")).toHaveTextContent("PENDING");

    rerender(
      <TaskProvider key={2} userId={2} intervalMs={20}>
        <Probe />
      </TaskProvider>,
    );

    expect(oldSignal.value?.aborted).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId("task-2")).toHaveTextContent("SUCCEEDED"),
    );

    oldRequest.resolve(jsonResponse(succeeded));
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(screen.queryByTestId("task-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-2")).toHaveTextContent("SUCCEEDED");
  });
});
