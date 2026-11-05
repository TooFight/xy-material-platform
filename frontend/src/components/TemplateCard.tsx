import Link from "next/link";

import { assetUrl } from "@/lib/api/client";
import type { TemplateSummary } from "@/lib/types";

import styles from "./TemplateCard.module.css";

/** 9:16 竖版封面卡，标题压在底部渐变上（UI-01）。 */
export function TemplateCard({ template }: { template: TemplateSummary }) {
  return (
    <li className={styles.item}>
      <Link
        href={`/templates/${encodeURIComponent(template.id)}`}
        className={styles.card}
        aria-label={`查看模板 ${template.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 封面域名由 NEXT_PUBLIC_API_BASE_URL 在运行时决定，无法预配置 next/image 的 remotePatterns。 */}
        <img
          className={styles.cover}
          src={assetUrl(template.coverUrl)}
          alt=""
          loading="lazy"
          width={540}
          height={960}
        />
        <span className={styles.count}>需 {template.requiredImageCount} 张图</span>
        <span className={styles.title}>{template.title}</span>
      </Link>
    </li>
  );
}
