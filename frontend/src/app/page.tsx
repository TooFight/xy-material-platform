"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ChannelTabs } from "@/components/ChannelTabs";
import { TemplateBrowser, TemplateBrowserSkeleton } from "@/components/TemplateBrowser";

import styles from "./page.module.css";

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category")?.trim() || null;

  const handleCategoryChange = useCallback(
    (nextCategory: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextCategory) {
        params.set("category", nextCategory);
      } else {
        params.delete("category");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return <TemplateBrowser category={category} onCategoryChange={handleCategoryChange} />;
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <ChannelTabs />
      <Suspense fallback={<TemplateBrowserSkeleton />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
