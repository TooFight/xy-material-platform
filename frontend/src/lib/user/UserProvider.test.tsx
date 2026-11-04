import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { installFetch, jsonResponse } from "@/test/fixtures";
import type { UserDTO } from "@/lib/types";

import { USER_STORAGE_KEY, UserProvider, useUser } from "./UserProvider";

const users: UserDTO[] = [
  { id: 1, username: "alice", displayName: "Alice" },
  { id: 2, username: "bob", displayName: "Bob" },
];

function Consumer() {
  const { userId, users: userList, status, switchUser } = useUser();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{userId ?? "none"}</span>
      <select
        aria-label="测试身份切换"
        value={userId ?? ""}
        onChange={(event) => switchUser(Number(event.target.value))}
        disabled={status !== "ready"}
      >
        {userList.map((user) => (
          <option key={user.id} value={user.id}>
            {user.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

function renderProvider() {
  return render(
    <UserProvider>
      <Consumer />
    </UserProvider>,
  );
}

describe("UserProvider", () => {
  it("首次访问默认选择第一个用户并写入 localStorage", async () => {
    const fetchMock = installFetch((url) => {
      if (url.pathname === "/api/users") {
        return Promise.resolve(jsonResponse(users));
      }
      return Promise.reject(new Error(`首次访问不应请求 ${url.pathname}`));
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user")).toHaveTextContent("1");
    expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe("1");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/me"))).toBe(false);
  });

  it("刷新后使用 localStorage 中保存的用户，并通过 /api/me 校验", async () => {
    window.localStorage.setItem(USER_STORAGE_KEY, "2");
    let meHeader: string | null = null;

    installFetch((url, init) => {
      if (url.pathname === "/api/users") {
        return Promise.resolve(jsonResponse(users));
      }
      if (url.pathname === "/api/me") {
        meHeader = new Headers(init?.headers).get("X-User-Id");
        return Promise.resolve(jsonResponse(users[1]));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user")).toHaveTextContent("2");
    expect(meHeader).toBe("2");
    expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe("2");
  });

  it("保存的身份已失效（/api/me 返回 401）时回退到第一个用户", async () => {
    window.localStorage.setItem(USER_STORAGE_KEY, "2");

    installFetch((url) => {
      if (url.pathname === "/api/users") {
        return Promise.resolve(jsonResponse(users));
      }
      if (url.pathname === "/api/me") {
        return Promise.resolve(
          jsonResponse({ code: "UNAUTHORIZED", message: "身份无效" }, { status: 401 }),
        );
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user")).toHaveTextContent("1");
    expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe("1");
  });

  it("switchUser 更新当前用户并持久化", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.pathname === "/api/users") {
        return Promise.resolve(jsonResponse(users));
      }
      return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await user.selectOptions(screen.getByLabelText("测试身份切换"), "2");

    expect(screen.getByTestId("user")).toHaveTextContent("2");
    expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe("2");
  });
});
