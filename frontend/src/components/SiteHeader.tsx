"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserSwitcher } from "@/components/UserSwitcher";
import { useTasks } from "@/lib/tasks/TaskProvider";

import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { activeCount, isRestoring } = useTasks();

  // 制作页按 UI-02 / UI-03 做成全屏双栏，不显示顶栏；页内有返回按钮。
  if (pathname.startsWith("/templates/")) {
    return null;
  }

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="小影素材工坊，返回模板列表">
        <span className={styles.mark} aria-hidden="true">
          <span className={styles.face}>
            <span className={styles.eye} />
            <span className={styles.eye} />
          </span>
        </span>
      </Link>

      <div className={styles.actions}>
        {/* 全局未完成任务数；恢复期间显示加载状态，不显示 0。 */}
        <span
          className={styles.taskIndicator}
          data-active={!isRestoring && activeCount > 0}
          role="status"
          aria-live="polite"
        >
          <span className={styles.pulse} aria-hidden="true" />
          {isRestoring ? "任务加载中…" : `${activeCount} 个任务处理中`}
        </span>
        <UserSwitcher />
      </div>
    </header>
  );
}
