"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError, isAbortError, toApiError } from "@/lib/api/client";
import { getCurrentUser, listUsers } from "@/lib/api/users";
import type { UserDTO } from "@/lib/types";

export const USER_STORAGE_KEY = "xy.userId";

export type UserStatus = "loading" | "ready" | "error";

export interface UserContextValue {
  users: UserDTO[];
  userId: number | null;
  status: UserStatus;
  error: ApiError | null;
  switchUser: (userId: number) => void;
  reload: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function persistUserId(userId: number): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, String(userId));
  } catch {
    // localStorage 不可用时只影响刷新后的身份保留，不阻断页面。
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [status, setStatus] = useState<UserStatus>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load(): Promise<void> {
      try {
        const list = await listUsers({ signal: controller.signal });
        if (!active) {
          return;
        }
        setUsers(list);

        if (list.length === 0) {
          setUserId(null);
          setStatus("ready");
          return;
        }

        const storedUserId = readStoredUserId();
        const storedUser = storedUserId === null ? undefined : list.find((user) => user.id === storedUserId);
        let candidate = storedUser ?? list[0];

        // 只有存在本地保存的身份时才调用 /api/me；401 表示该身份已失效。
        if (storedUser) {
          try {
            const currentUser = await getCurrentUser({
              userId: storedUser.id,
              signal: controller.signal,
            });
            if (!active) {
              return;
            }
            candidate = list.find((user) => user.id === currentUser.id) ?? candidate;
          } catch (meError) {
            if (!active || isAbortError(meError)) {
              return;
            }
            if (meError instanceof ApiError && meError.kind === "http" && meError.status === 401) {
              candidate = list[0];
            }
            // 网络错误或 5xx 不能说明身份失效，保留 users 列表中的候选身份。
          }
        }

        if (!active) {
          return;
        }
        setUserId(candidate.id);
        persistUserId(candidate.id);
        setStatus("ready");
      } catch (loadError) {
        if (!active || isAbortError(loadError)) {
          return;
        }
        setError(toApiError(loadError));
        setStatus("error");
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const switchUser = useCallback(
    (nextUserId: number) => {
      if (!users.some((user) => user.id === nextUserId)) {
        return;
      }
      setUserId(nextUserId);
      persistUserId(nextUserId);
    },
    [users],
  );

  const reload = useCallback(() => {
    setStatus("loading");
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      users,
      userId,
      status,
      error,
      switchUser,
      reload,
    }),
    [users, userId, status, error, switchUser, reload],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser 必须在 UserProvider 内使用");
  }
  return context;
}
