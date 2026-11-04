import { vi } from "vitest";

import type { TemplateCategory, TemplateSummary } from "@/lib/types";

export const categories: TemplateCategory[] = [
  { code: "creative", name: "创意图片", templateCount: 2 },
  { code: "festival", name: "节日贺卡", templateCount: 1 },
];

export const travelPostcard: TemplateSummary = {
  id: "demo-postcard",
  title: "旅行明信片",
  category: { code: "creative", name: "创意图片" },
  coverUrl: "/demo/covers/postcard.png",
  requiredImageCount: 2,
};

export const comic: TemplateSummary = {
  id: "demo-comic",
  title: "漫画分镜",
  category: { code: "creative", name: "创意图片" },
  coverUrl: "/demo/covers/comic.png",
  requiredImageCount: 4,
};

export const springCard: TemplateSummary = {
  id: "demo-spring-card",
  title: "新春贺卡",
  category: { code: "festival", name: "节日贺卡" },
  coverUrl: "/demo/covers/spring-card.png",
  requiredImageCount: 1,
};

export const allTemplates: TemplateSummary[] = [travelPostcard, comic];
export const festivalTemplates: TemplateSummary[] = [springCard];

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export type FetchHandler = (url: URL, init?: RequestInit) => Promise<Response>;

/** 把 fetch 替换成按 URL 分发的假实现，并返回 mock 以便断言调用。 */
export function installFetch(handler: FetchHandler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handler(new URL(String(input)), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
