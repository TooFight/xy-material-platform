"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./ChannelTabs.module.css";

const CHANNELS = [
  { href: "/", label: "模板" },
  { href: "/history", label: "我的作品" },
] as const;

/** 页面顶部的胶囊频道切换（对应 UI-01 的一级频道行）。 */
export function ChannelTabs() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className={styles.channels} aria-label="主导航">
      {CHANNELS.map((channel) => {
        const isActive =
          channel.href === "/"
            ? pathname === "/"
            : pathname === channel.href || pathname.startsWith(`${channel.href}/`);
        return (
          <Link
            key={channel.href}
            href={channel.href}
            className={styles.channel}
            aria-current={isActive ? "page" : undefined}
          >
            {channel.label}
          </Link>
        );
      })}
    </nav>
  );
}
