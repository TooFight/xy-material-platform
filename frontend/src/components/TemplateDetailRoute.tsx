"use client";

import { useUser } from "@/lib/user/UserProvider";

import { TemplateDetail } from "./TemplateDetail";

/**
 * 把当前身份注入详情页。F3 可以在这里接 TaskProvider / onSubmitted，
 * 把提交成功的任务加入全局任务表。
 */
export function TemplateDetailRoute({ templateId }: { templateId: string }) {
  const { userId } = useUser();
  return <TemplateDetail templateId={templateId} userId={userId} />;
}
