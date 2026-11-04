"use client";

import { useUser } from "@/lib/user/UserProvider";

import styles from "./UserSwitcher.module.css";

export function UserSwitcher() {
  const { users, userId, status, switchUser, reload } = useUser();

  if (status === "error") {
    return (
      <div className={styles.error} role="alert">
        <span>身份加载失败</span>
        <button type="button" onClick={reload}>
          重试
        </button>
      </div>
    );
  }

  const isLoading = status === "loading";
  const hasUsers = users.length > 0;
  const selectValue = !isLoading && hasUsers && userId !== null ? String(userId) : "";

  return (
    <label className={styles.switcher}>
      <span className={styles.label}>当前身份</span>
      <select
        className={styles.select}
        value={selectValue}
        onChange={(event) => switchUser(Number(event.target.value))}
        disabled={isLoading || !hasUsers}
        aria-label="切换当前用户身份"
      >
        {isLoading && <option value="">加载中…</option>}
        {!isLoading && !hasUsers && <option value="">无可用用户</option>}
        {!isLoading &&
          hasUsers &&
          users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
      </select>
    </label>
  );
}
