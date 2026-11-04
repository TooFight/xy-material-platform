import type { UserDTO } from "@/lib/types";

import { request } from "./client";

interface SignalOptions {
  signal?: AbortSignal;
}

/** GET /api/users（公开）：身份切换器的候选用户。 */
export function listUsers(options: SignalOptions = {}): Promise<UserDTO[]> {
  return request<UserDTO[]>("/api/users", {
    signal: options.signal,
  });
}

/** GET /api/me：确认 localStorage 中保存的身份仍然有效。 */
export function getCurrentUser(options: SignalOptions & { userId: number }): Promise<UserDTO> {
  return request<UserDTO>("/api/me", {
    userId: options.userId,
    signal: options.signal,
  });
}
