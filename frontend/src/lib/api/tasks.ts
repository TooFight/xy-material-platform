import type { ActiveTaskListResponse, TaskDTO, TaskListResponse } from "@/lib/types";

import { request } from "./client";

export interface SubmitTaskInput {
  templateId: string;
  assetIds: number[];
  userId: number;
  signal?: AbortSignal;
}

export interface GetTaskOptions {
  taskId: number;
  userId: number;
  signal?: AbortSignal;
}

export interface ListTasksOptions {
  userId: number;
  active?: boolean;
  page?: number;
  size?: number;
  signal?: AbortSignal;
}

/** POST /api/tasks：返回 202 + TaskDTO；任务展示与轮询由 TaskProvider 接入。 */
export function submitTask(input: SubmitTaskInput): Promise<TaskDTO> {
  return request<TaskDTO>("/api/tasks", {
    method: "POST",
    body: {
      templateId: input.templateId,
      assetIds: input.assetIds,
    },
    userId: input.userId,
    signal: input.signal,
  });
}

/** GET /api/tasks/{id}：只读查询，不推进任务。 */
export function getTask(options: GetTaskOptions): Promise<TaskDTO> {
  return request<TaskDTO>(`/api/tasks/${options.taskId}`, {
    userId: options.userId,
    signal: options.signal,
  });
}

export function listTasks(
  options: ListTasksOptions & { active: true },
): Promise<ActiveTaskListResponse>;
export function listTasks(
  options: ListTasksOptions & { active?: false },
): Promise<TaskListResponse>;
export function listTasks(
  options: ListTasksOptions,
): Promise<TaskListResponse | ActiveTaskListResponse>;
export function listTasks(
  options: ListTasksOptions,
): Promise<TaskListResponse | ActiveTaskListResponse> {
  const params = new URLSearchParams();
  if (options.active) {
    params.set("active", "true");
  } else {
    if (options.page !== undefined) {
      params.set("page", String(options.page));
    }
    if (options.size !== undefined) {
      params.set("size", String(options.size));
    }
  }

  const query = params.toString();
  return request<TaskListResponse | ActiveTaskListResponse>(
    `/api/tasks${query ? `?${query}` : ""}`,
    {
      userId: options.userId,
      signal: options.signal,
    },
  );
}
