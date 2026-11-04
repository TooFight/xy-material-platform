import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  allTemplates,
  categories,
  festivalTemplates,
  installFetch,
  jsonResponse,
} from "@/test/fixtures";

import HomePage from "./page";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/",
  useSearchParams: () => navigation.search,
}));

function installTemplateFetch() {
  return installFetch((url) => {
    if (url.pathname === "/api/template-categories") {
      return Promise.resolve(jsonResponse(categories));
    }
    if (url.pathname === "/api/templates") {
      return Promise.resolve(
        jsonResponse(
          url.searchParams.get("category") === "festival" ? festivalTemplates : allTemplates,
        ),
      );
    }
    return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    navigation.search = new URLSearchParams();
    navigation.replace.mockReset();
  });

  it("从 ?category= 恢复选中分类", async () => {
    navigation.search = new URLSearchParams("category=festival");
    installTemplateFetch();

    render(<HomePage />);

    const festivalTab = await screen.findByRole("button", { name: /节日贺卡/ });
    expect(festivalTab).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("link", { name: /新春贺卡/ })).toBeInTheDocument();
  });

  it("点击分类时把 category 写入 URL", async () => {
    const user = userEvent.setup();
    installTemplateFetch();

    render(<HomePage />);

    const festivalTab = await screen.findByRole("button", { name: /节日贺卡/ });
    await user.click(festivalTab);

    expect(navigation.replace).toHaveBeenCalledWith("/?category=festival", { scroll: false });
  });

  it("点击“全部”时从 URL 移除 category", async () => {
    const user = userEvent.setup();
    navigation.search = new URLSearchParams("category=festival");
    installTemplateFetch();

    render(<HomePage />);

    await screen.findByRole("link", { name: /新春贺卡/ });
    await user.click(screen.getByRole("button", { name: "全部" }));

    expect(navigation.replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});
