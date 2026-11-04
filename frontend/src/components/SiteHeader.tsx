"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserSwitcher } from "@/components/UserSwitcher";

import styles from "./SiteHeader.module.css";

const NAV_ITEMS = [
  { href: "/", label: "模板" },
  { href: "/history", label: "我的作品" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="小影素材工坊，返回模板列表">
          <span className={styles.mark} aria-hidden="true">
            影
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>小影素材工坊</span>
            <span className={styles.brandTag}>MATERIAL STUDIO</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.navLink}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          {/* F3 接入 TaskProvider 后，把 0 替换为实际的未完成任务数。 */}
          <span className={styles.taskIndicator} role="status" aria-live="polite">
            <span className={styles.pulse} aria-hidden="true" />0 个任务处理中
          </span>
          <UserSwitcher />
        </div>
      </div>
    </header>
  );
}
