import type { ActiveTaskListResponse, TaskDTO, TaskListResponse } from "@/lib/types";

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

/**
 * F3 / M8 实现：POST /api/tasks（202 + TaskDTO）。
 * F1 只保留函数签名。
 */
export function submitTask(input: SubmitTaskInput): Promise<TaskDTO> {
  void input;
  return Promise.reject(new Error("submitTask 将在 F3（M8）中实现"));
}

/** F3 / M8 实现：GET /api/tasks/{id}（只读，不推进任务）。 */
export function getTask(options: GetTaskOptions): Promise<TaskDTO> {
  void options;
  return Promise.reject(new Error("getTask 将在 F3（M8）中实现"));
}

/** F3 / M8 实现：GET /api/tasks（分页历史或 active=true 恢复跟踪）。 */
export function listTasks(options: ListTasksOptions): Promise<TaskListResponse | ActiveTaskListResponse> {
  void options;
  return Promise.reject(new Error("listTasks 将在 F3（M8）中实现"));
}
