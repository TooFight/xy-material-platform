import type { TemplateCategory, TemplateDetail, TemplateSummary } from "@/lib/types";

import { request } from "./client";

interface SignalOptions {
  signal?: AbortSignal;
}

export interface ListTemplatesOptions extends SignalOptions {
  /** 分类 code；不传或传 null 表示全部分类。 */
  category?: string | null;
}

export function listTemplateCategories(options: SignalOptions = {}): Promise<TemplateCategory[]> {
  return request<TemplateCategory[]>("/api/template-categories", {
    signal: options.signal,
  });
}

export function listTemplates(options: ListTemplatesOptions = {}): Promise<TemplateSummary[]> {
  const category = options.category?.trim();
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return request<TemplateSummary[]>(`/api/templates${query}`, {
    signal: options.signal,
  });
}

/** 模板详情（F2 / M7 使用）。 */
export function getTemplate(templateId: string, options: SignalOptions = {}): Promise<TemplateDetail> {
  return request<TemplateDetail>(`/api/templates/${encodeURIComponent(templateId)}`, {
    signal: options.signal,
  });
}
