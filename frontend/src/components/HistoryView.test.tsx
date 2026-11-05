import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TaskProvider } from "@/lib/tasks/TaskProvider";
import type { TaskDTO } from "@/lib/types";
import { installFetch, jsonResponse, makeTask, deferred } from "@/test/fixtures";

import { HistoryView } from "./HistoryView";

function renderHistory() {
  return render(
    <TaskProvider userId={1} intervalMs={20}>
      <HistoryView userId={1} />
    </TaskProvider>,
  );
}

function pageResponse(items: TaskDTO[], page: number, total: number) {
  return jsonResponse({ items, page, size: 10, total });
}

describe("HistoryView", () => {
  it("加载中显示骨架，随后渲染历史任务", async () => {
    const completed = makeTask(1, {
      status: "SUCCEEDED",
      stage: "FINALIZING",
      resultUrl: "/files/results/1.png",
    });
    const failed = makeTask(2, {
      status: "FAILED",
      stage: "CHECKING",
      failedStage: "CHECKING",
      failureReason: "模拟检查失败",
      createdAt: "2026-11-04T08:31:15.000Z",
    });

    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        return Promise.resolve(pageResponse([completed, failed], 1, 2));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderHistory();

    expect(screen.getByText("正在加载历史记录…")).toBeInTheDocument();
    expect(await screen.findByText("共 2 个任务")).toBeInTheDocument();
    expect(screen.getAllByText("旅行明信片")).toHaveLength(2);
    expect(screen.getAllByText("已完成").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("素材检查：失败")).toBeInTheDocument();
    expect(screen.getByText("模拟检查失败")).toBeInTheDocument();
  });

  it("空数据时显示空状态和浏览模板入口", async () => {
    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        return Promise.resolve(pageResponse([], 1, 0));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderHistory();

    expect(await screen.findByText("还没有作品")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "浏览模板" })).toHaveAttribute("href", "/");
  });

  it("请求失败显示错误和重试按钮，重试成功", async () => {
    let pageCalls = 0;
    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        pageCalls += 1;
        if (pageCalls === 1) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "历史服务暂时不可用" },
              { status: 500 },
            ),
          );
        }
        return Promise.resolve(pageResponse([makeTask(1, { status: "SUCCEEDED", stage: "FINALIZING" })], 1, 1));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    const user = userEvent.setup();
    renderHistory();

    expect(await screen.findByText("历史记录加载失败")).toBeInTheDocument();
    expect(screen.getByText("历史服务暂时不可用")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByText("共 1 个任务")).toBeInTheDocument();
    expect(pageCalls).toBe(2);
  });

  it("已有数据时刷新失败保留列表并显示错误提示，重试成功后恢复", async () => {
    const user = userEvent.setup();
    let pageCalls = 0;
    const task = makeTask(1, { status: "SUCCEEDED", stage: "FINALIZING" });

    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        pageCalls += 1;
        if (pageCalls === 2) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "刷新暂时失败" },
              { status: 500 },
            ),
          );
        }
        return Promise.resolve(pageResponse([task], 1, 1));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderHistory();

    expect(await screen.findByText("共 1 个任务")).toBeInTheDocument();
    expect(screen.getAllByText("旅行明信片").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "刷新" }));

    expect(
      await screen.findByText(/历史记录刷新失败，已保留上次结果/),
    ).toBeInTheDocument();
    expect(screen.getByText(/刷新暂时失败/)).toBeInTheDocument();
    expect(screen.getByText("共 1 个任务")).toBeInTheDocument();
    expect(screen.getAllByText("旅行明信片").length).toBeGreaterThan(0);
    expect(pageCalls).toBe(2);

    await user.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() =>
      expect(screen.queryByText(/历史记录刷新失败/)).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText("旅行明信片").length).toBeGreaterThan(0);
    expect(pageCalls).toBe(3);
  });

  it("翻页失败显示整页错误，可返回上一页", async () => {
    const user = userEvent.setup();
    const allTasks = Array.from({ length: 25 }, (_, index) =>
      makeTask(index + 1, {
        status: "SUCCEEDED",
        stage: "FINALIZING",
        createdAt: `2026-11-04T08:${String(index).padStart(2, "0")}:00.000Z`,
      }),
    );

    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        const page = Number(url.searchParams.get("page") ?? "1");
        if (page === 2) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "第二页加载失败" },
              { status: 500 },
            ),
          );
        }
        return Promise.resolve(pageResponse(allTasks.slice(0, 10), 1, allTasks.length));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderHistory();

    expect(await screen.findByText("第 1 / 3 页")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("这一页加载失败")).toBeInTheDocument();
    expect(screen.getByText("第二页加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回上一页" }));

    expect(await screen.findByText("第 1 / 3 页")).toBeInTheDocument();
    expect(screen.getAllByText("旅行明信片").length).toBeGreaterThan(0);
  });

  it("支持分页加载下一页", async () => {
    const user = userEvent.setup();
    const allTasks = Array.from({ length: 25 }, (_, index) =>
      makeTask(index + 1, {
        status: "SUCCEEDED",
        stage: "FINALIZING",
        createdAt: `2026-11-04T08:${String(index).padStart(2, "0")}:00.000Z`,
      }),
    );

    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        const page = Number(url.searchParams.get("page") ?? "1");
        const items = allTasks.slice((page - 1) * 10, page * 10);
        return Promise.resolve(pageResponse(items, page, allTasks.length));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderHistory();

    expect(await screen.findByText("共 25 个任务")).toBeInTheDocument();
    expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("第 2 / 3 页")).toBeInTheDocument();
  });

  it("未完成任务交给 Provider 跟踪，列表实时更新到终态", async () => {
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
    const taskPoll = deferred<Response>();

    installFetch((url) => {
      if (url.pathname === "/api/tasks" && url.searchParams.get("active") === "true") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.pathname === "/api/tasks") {
        return Promise.resolve(pageResponse([running], 1, 1));
      }
      if (url.pathname === "/api/tasks/1") {
        return taskPoll.promise;
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderHistory();

    await waitFor(() => expect(screen.getByText("处理中")).toBeInTheDocument());
    taskPoll.resolve(jsonResponse(succeeded));
    await waitFor(() => expect(screen.getAllByText("已完成").length).toBeGreaterThan(0));
    expect(screen.queryByText("处理中")).not.toBeInTheDocument();
  });
});
