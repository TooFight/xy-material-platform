import Link from "next/link";

import { assetUrl } from "@/lib/api/client";
import type { TemplateSummary } from "@/lib/types";

import styles from "./TemplateCard.module.css";

export function TemplateCard({ template }: { template: TemplateSummary }) {
  return (
    <li className={styles.item}>
      <Link
        href={`/templates/${encodeURIComponent(template.id)}`}
        className={styles.card}
        aria-label={`查看模板 ${template.title}`}
      >
        <span className={styles.cover}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 封面域名由 NEXT_PUBLIC_API_BASE_URL 在运行时决定，无法预配置 next/image 的 remotePatterns。 */}
          <img src={assetUrl(template.coverUrl)} alt="" loading="lazy" width={640} height={480} />
          <span className={styles.category}>{template.category.name}</span>
        </span>
        <span className={styles.body}>
          <span className={styles.title}>{template.title}</span>
          <span className={styles.meta}>
            <span className={styles.count}>需 {template.requiredImageCount} 张图</span>
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
