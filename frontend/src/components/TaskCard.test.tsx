import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { TaskDTO } from "@/lib/types";
import { createTaskEntry } from "@/lib/tasks/taskReducer";
import { makeTask } from "@/test/fixtures";

import { TaskCard } from "./TaskCard";

function entryFor(task: TaskDTO) {
  return createTaskEntry(task);
}

describe("TaskCard", () => {
  it("RUNNING 阶段条：之前完成、当前进行中、之后未开始", () => {
    const entry = entryFor(
      makeTask(1, {
        status: "RUNNING",
        stage: "GENERATING",
        startedAt: "2026-11-04T08:30:20.000Z",
      }),
    );

    render(<TaskCard entry={entry} onRetry={vi.fn()} />);

    expect(screen.getByText("处理中")).toBeInTheDocument();
    expect(screen.getByText("当前阶段：模拟生成")).toBeInTheDocument();
    expect(screen.getByLabelText("素材检查：已完成")).toBeInTheDocument();
    expect(screen.getByLabelText("模拟生成：进行中")).toBeInTheDocument();
    expect(screen.getByLabelText("结果整理：未开始")).toBeInTheDocument();
  });

  it("FAILED 时失败阶段之后显示未执行，并显示失败原因", () => {
    const entry = entryFor(
      makeTask(1, {
        status: "FAILED",
        stage: "GENERATING",
        failedStage: "GENERATING",
        failureReason: "模拟生成失败：已按配置中断",
      }),
    );

    render(<TaskCard entry={entry} onRetry={vi.fn()} />);

    expect(screen.getByText("任务失败（模拟生成）")).toBeInTheDocument();
    expect(screen.getByLabelText("素材检查：已完成")).toBeInTheDocument();
    expect(screen.getByLabelText("模拟生成：失败")).toBeInTheDocument();
    expect(screen.getByLabelText("结果整理：未执行")).toBeInTheDocument();
    expect(screen.getByText("模拟生成失败：已按配置中断")).toBeInTheDocument();
  });

  it("FAILED 且 failedStage 为空、stage 有值时按 stage 显示中断阶段", () => {
    const entry = entryFor(
      makeTask(1, {
        status: "FAILED",
        stage: "GENERATING",
        failedStage: null,
        failureReason: "服务重启，任务已中断",
      }),
    );

    render(<TaskCard entry={entry} onRetry={vi.fn()} />);

    expect(screen.getByText("任务中断于模拟生成")).toBeInTheDocument();
    expect(screen.getByText("中断于模拟生成")).toBeInTheDocument();
    expect(screen.getByLabelText("素材检查：已完成")).toBeInTheDocument();
    expect(screen.getByLabelText("模拟生成：失败")).toBeInTheDocument();
    expect(screen.getByLabelText("结果整理：未执行")).toBeInTheDocument();
    expect(screen.getByText("服务重启，任务已中断")).toBeInTheDocument();
    expect(screen.queryByText("任务尚未开始执行。")).not.toBeInTheDocument();
  });

  it("FAILED 且 failedStage 与 stage 都为空时显示任务尚未开始执行", () => {
    const entry = entryFor(
      makeTask(1, {
        status: "FAILED",
        stage: null,
        failedStage: null,
        failureReason: "服务重启，任务未能开始",
      }),
    );

    render(<TaskCard entry={entry} onRetry={vi.fn()} />);

    expect(screen.getByText("任务失败")).toBeInTheDocument();
    expect(screen.getByText("任务尚未开始执行。")).toBeInTheDocument();
    expect(screen.getByLabelText("素材检查：未开始")).toBeInTheDocument();
    expect(screen.getByLabelText("模拟生成：未开始")).toBeInTheDocument();
    expect(screen.getByLabelText("结果整理：未开始")).toBeInTheDocument();
    expect(screen.queryByText(/任务中断于/)).not.toBeInTheDocument();
  });

  it("查询异常用独立的警告区展示，并与任务失败区分，可重新查询", () => {
    const onRetry = vi.fn();
    const entry = {
      ...entryFor(
        makeTask(1, {
          status: "RUNNING",
          stage: "CHECKING",
        }),
      ),
      syncError: new ApiError({
        kind: "network",
        status: null,
        code: "NETWORK_ERROR",
        message: "网络连接失败",
      }),
      consecutiveErrors: 3,
      paused: true,
    };

    render(<TaskCard entry={entry} onRetry={onRetry} />);

    expect(screen.getByText("状态暂时无法获取，已保留上次结果")).toBeInTheDocument();
    expect(screen.getByText("网络连接失败")).toBeInTheDocument();
    expect(screen.getByText("自动查询已暂停，请手动重新查询。")).toBeInTheDocument();
    expect(screen.queryByText("任务失败")).not.toBeInTheDocument();
    expect(screen.getByText("处理中")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新查询" }));
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it("成功结果缩略图打开 dialog，关闭后焦点回到缩略图", () => {
    if (typeof HTMLDialogElement !== "undefined") {
      Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
        configurable: true,
        value: function showModal(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      });
      Object.defineProperty(HTMLDialogElement.prototype, "close", {
        configurable: true,
        value: function close(this: HTMLDialogElement) {
          this.removeAttribute("open");
          this.dispatchEvent(new Event("close"));
        },
      });
    }

    const entry = entryFor(
      makeTask(1, {
        status: "SUCCEEDED",
        stage: "FINALIZING",
        resultUrl: "/files/results/1.png",
      }),
    );

    render(<TaskCard entry={entry} onRetry={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /查看旅行明信片结果大图/ });
    fireEvent.click(trigger);

    const dialog = document.querySelector("dialog");
    if (!(dialog instanceof HTMLDialogElement)) {
      throw new Error("dialog 未渲染");
    }
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "关闭结果预览" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭结果预览" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });
});
