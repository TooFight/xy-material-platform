import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  allTemplates,
  categories,
  deferred,
  festivalTemplates,
  installFetch,
  jsonResponse,
} from "@/test/fixtures";

import { TemplateBrowser } from "./TemplateBrowser";

function BrowserHarness() {
  const [category, setCategory] = useState<string | null>(null);
  return <TemplateBrowser category={category} onCategoryChange={setCategory} />;
}

function templateRequestUrls(fetchMock: ReturnType<typeof installFetch>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/templates"));
}

describe("TemplateBrowser", () => {
  it("先展示加载骨架，再渲染模板卡片", async () => {
    installFetch(async (url) => {
      if (url.pathname === "/api/template-categories") {
        return jsonResponse(categories);
      }
      if (url.pathname === "/api/templates") {
        return jsonResponse(allTemplates);
      }
      return jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 });
    });

    render(<BrowserHarness />);

    expect(screen.getByText("正在加载模板…")).toBeInTheDocument();

    expect(await screen.findByRole("link", { name: /旅行明信片/ })).toBeInTheDocument();
    expect(screen.getByText("需 2 张图")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("正在加载模板…")).not.toBeInTheDocument();
  });

  it("请求失败时展示重试按钮，点击后可以恢复", async () => {
    const user = userEvent.setup();
    let templateAttempts = 0;
    installFetch(async (url) => {
      if (url.pathname === "/api/template-categories") {
        return jsonResponse(categories);
      }
      if (url.pathname === "/api/templates") {
        templateAttempts += 1;
        if (templateAttempts === 1) {
          return jsonResponse(
            { code: "INTERNAL_ERROR", message: "服务暂时不可用" },
            { status: 500, statusText: "Internal Server Error" },
          );
        }
        return jsonResponse(allTemplates);
      }
      return jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 });
    });

    render(<BrowserHarness />);

    expect(await screen.findByText("服务暂时不可用")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByRole("link", { name: /旅行明信片/ })).toBeInTheDocument();
    expect(screen.queryByText("服务暂时不可用")).not.toBeInTheDocument();
    expect(templateAttempts).toBe(2);
  });

  it("空数据时展示空状态提示", async () => {
    installFetch(async (url) => {
      if (url.pathname === "/api/template-categories") {
        return jsonResponse(categories);
      }
      if (url.pathname === "/api/templates") {
        return jsonResponse([]);
      }
      return jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 });
    });

    render(<BrowserHarness />);

    expect(await screen.findByText("该分类下暂无模板")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /旅行明信片/ })).not.toBeInTheDocument();
  });

  it("快速切换分类时，旧响应不会覆盖新分类的结果", async () => {
    const user = userEvent.setup();
    const allDeferred = deferred<Response>();
    const festivalDeferred = deferred<Response>();

    const fetchMock = installFetch((url) => {
      if (url.pathname === "/api/template-categories") {
        return Promise.resolve(jsonResponse(categories));
      }
      if (url.pathname === "/api/templates") {
        return url.searchParams.get("category") === "festival"
          ? festivalDeferred.promise
          : allDeferred.promise;
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    render(<BrowserHarness />);

    const festivalTab = await screen.findByRole("button", { name: /节日贺卡/ });
    await waitFor(() => {
      expect(templateRequestUrls(fetchMock).some((url) => !url.includes("category="))).toBe(true);
    });

    await user.click(festivalTab);

    await waitFor(() => {
      expect(festivalTab).toHaveAttribute("aria-pressed", "true");
      expect(templateRequestUrls(fetchMock).some((url) => url.includes("category=festival"))).toBe(
        true,
      );
    });

    await act(async () => {
      festivalDeferred.resolve(jsonResponse(festivalTemplates));
    });
    expect(await screen.findByRole("link", { name: /新春贺卡/ })).toBeInTheDocument();

    await act(async () => {
      allDeferred.resolve(jsonResponse(allTemplates));
    });

    expect(screen.getByRole("link", { name: /新春贺卡/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /旅行明信片/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /节日贺卡/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
