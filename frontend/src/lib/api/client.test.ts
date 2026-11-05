import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, assetUrl, isAbortError, request } from "./client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("把非 2xx 响应解析为带 status/code/message 的 ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: "VALIDATION_ERROR",
          message: "需要上传 2 张图片，当前为 1 张",
          details: [{ field: "assetIds", message: "数量不符" }],
        },
        { status: 400, statusText: "Bad Request" },
      ),
    );

    const error = await request("/api/tasks", { method: "POST" }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.kind).toBe("http");
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.message).toBe("需要上传 2 张图片，当前为 1 张");
    expect(apiError.details).toEqual([{ field: "assetIds", message: "数量不符" }]);
  });

  it("网络异常转换为 kind='network' 的 ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await request("/api/templates").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.kind).toBe("network");
    expect(apiError.status).toBeNull();
    expect(apiError.code).toBe("NETWORK_ERROR");
  });

  it("自动附加 X-User-Id 请求头", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ id: 2, username: "bob", displayName: "Bob" }]),
    );

    await request("/api/me", { userId: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/api/me");
    expect(new Headers(init.headers).get("X-User-Id")).toBe("2");
  });

  it("主动取消时原样抛出 AbortError，不包装成 ApiError", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abortError);
    controller.abort();

    const error = await request("/api/templates", { signal: controller.signal }).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBe(abortError);
    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe("assetUrl", () => {
  it("把后端相对路径拼成完整地址，绝对地址原样返回", () => {
    expect(assetUrl("/demo/covers/postcard.png")).toBe(
      "http://localhost:8080/demo/covers/postcard.png",
    );
    expect(assetUrl("https://cdn.example.com/cover.png")).toBe(
      "https://cdn.example.com/cover.png",
    );
  });

  it("签名 URL 作为不透明字符串处理，不解析或改写查询参数", () => {
    const signedPath =
      "/files/results/abc.png?X-Amz-Signature=abc%2Fdef&X-Amz-Date=20261105T000000Z";
    expect(assetUrl(signedPath)).toBe(`http://localhost:8080${signedPath}`);

    const signedAbsolute =
      "https://cdn.example.com/results/abc.png?token=a%2Fb&expires=123";
    expect(assetUrl(signedAbsolute)).toBe(signedAbsolute);
  });
});
