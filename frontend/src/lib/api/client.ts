import type { ApiErrorDetail } from "@/lib/types";

const DEFAULT_API_BASE_URL = "http://localhost:8080";

const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试。";

export type ApiErrorKind = "http" | "network";

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  status?: number | null;
  code: string;
  message: string;
  details?: ApiErrorDetail[] | null;
}

/**
 * 统一的接口错误。
 * - kind='http'：服务端返回了非 2xx，status/code/message 来自响应体。
 * - kind='network'：请求没有拿到响应（断网、DNS、CORS 等），status 为 null。
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly details: ApiErrorDetail[] | null;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code;
    this.details = options.details ?? null;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** 有值时自动附加 X-User-Id 请求头。 */
  userId?: number | null;
  headers?: HeadersInit;
}

/**
 * NEXT_PUBLIC_* 会在 next build 时内联进浏览器产物，因此这里只读取该变量。
 * 本地未配置时回退到设计文档中的默认后端地址。
 */
function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  return configured.replace(/\/+$/, "") || DEFAULT_API_BASE_URL;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalizedPath}`;
}

/**
 * 把接口返回的相对地址（如 /demo/covers/postcard.png）拼成可直接用于 <img> 的完整地址。
 * 已经是绝对 http(s) 地址时原样返回。
 */
export function assetUrl(path: string): string {
  if (!path) {
    return "";
  }
  return buildUrl(path);
}

/**
 * 封装 fetch：统一 base URL、JSON 序列化、X-User-Id、错误结构与 AbortSignal。
 * 主动取消（AbortError）会原样抛出，调用方应直接忽略，不应展示为请求失败。
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, userId, headers: customHeaders } = options;
  const headers = new Headers(customHeaders);
  headers.set("Accept", "application/json");

  if (userId !== undefined && userId !== null) {
    headers.set("X-User-Id", String(userId));
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isFormData(body)) {
      requestBody = body;
    } else {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      requestBody = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: requestBody,
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new ApiError({
      kind: "network",
      status: null,
      code: "NETWORK_ERROR",
      message: NETWORK_ERROR_MESSAGE,
    });
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await readText(response);
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError({
      kind: "http",
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "服务返回了无法解析的数据，请稍后重试。",
    });
  }
}

/** 把未知异常归一为 ApiError，供页面展示。 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError({
    kind: "network",
    status: null,
    code: "NETWORK_ERROR",
    message: NETWORK_ERROR_MESSAGE,
  });
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function toHttpError(response: Response): Promise<ApiError> {
  const text = await readText(response);
  const payload = parseJsonObject(text);
  const code = typeof payload?.code === "string" && payload.code ? payload.code : `HTTP_${response.status}`;
  const bodyMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
  const message = bodyMessage || response.statusText.trim() || "请求失败，请稍后重试。";

  return new ApiError({
    kind: "http",
    status: response.status,
    code,
    message,
    details: parseDetails(payload?.details),
  });
}

async function readText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseDetails(value: unknown): ApiErrorDetail[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const details: ApiErrorDetail[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.message !== "string") {
      continue;
    }
    details.push({
      field: typeof record.field === "string" ? record.field : undefined,
      message: record.message,
    });
  }

  return details.length > 0 ? details : null;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}
