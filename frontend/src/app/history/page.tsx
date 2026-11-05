import type { Metadata } from "next";

import { ChannelTabs } from "@/components/ChannelTabs";
import { HistoryRoute } from "@/components/HistoryRoute";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "我的作品",
};

export default function HistoryPage() {
  return (
    <main className={styles.page}>
      <ChannelTabs />
      <HistoryRoute />
    </main>
  );
}
