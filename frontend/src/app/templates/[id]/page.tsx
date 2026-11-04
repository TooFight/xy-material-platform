import type { Metadata } from "next";

import { TemplateDetailRoute } from "@/components/TemplateDetailRoute";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "模板详情",
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className={styles.page}>
      <TemplateDetailRoute templateId={id} />
    </main>
  );
}
