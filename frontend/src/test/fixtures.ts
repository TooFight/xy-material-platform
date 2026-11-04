import { vi } from "vitest";

import type {
  AssetDTO,
  TaskDTO,
  TemplateCategory,
  TemplateDetail,
  TemplateSummary,
} from "@/lib/types";

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

export const travelPostcardDetail: TemplateDetail = {
  ...travelPostcard,
  description: "上传图片，模拟生成一张明信片",
  acceptedMimeTypes: ["image/jpeg", "image/png"],
  // 测试里用 1KB 上限，方便构造超限文件。
  maxFileSizeBytes: 1024,
};

export function makeAsset(id: number, templateId = "demo-postcard"): AssetDTO {
  return {
    id,
    templateId,
    originalFilename: `beach-${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 512,
    url: `/files/assets/${id}.jpg`,
    createdAt: "2026-11-04T08:30:12.345Z",
  };
}

export function makeTask(id = 42): TaskDTO {
  return {
    id,
    templateId: "demo-postcard",
    templateTitle: "旅行明信片",
    templateCoverUrl: "/demo/covers/postcard.png",
    status: "PENDING",
    stage: null,
    failedStage: null,
    failureReason: null,
    resultUrl: null,
    assets: [],
    stages: [],
    createdAt: "2026-11-04T08:30:15.000Z",
    startedAt: null,
    finishedAt: null,
    updatedAt: "2026-11-04T08:30:15.000Z",
  };
}

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
