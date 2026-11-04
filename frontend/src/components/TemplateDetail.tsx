"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, assetUrl, isAbortError, toApiError } from "@/lib/api/client";
import { getTemplate } from "@/lib/api/templates";
import type { TaskDTO, TemplateDetail as TemplateDetailDTO } from "@/lib/types";
import { formatFileSize, formatMimeTypes } from "@/lib/upload/fileValidation";

import { TemplateUploadForm } from "./TemplateUploadForm";
import styles from "./TemplateDetail.module.css";

type DetailStatus = "loading" | "ready" | "error" | "not-found";

interface DetailState {
  templateId: string;
  status: DetailStatus;
  template: TemplateDetailDTO | null;
  error: ApiError | null;
}

export interface TemplateDetailProps {
  templateId: string;
  userId: number | null;
  /** F3 接入任务展示的入口；F2 默认不传。 */
  onSubmitted?: (task: TaskDTO) => void;
}

export function TemplateDetail({ templateId, userId, onSubmitted }: TemplateDetailProps) {
  const [state, setState] = useState<DetailState>(() => ({
    templateId,
    status: "loading",
    template: null,
    error: null,
  }));
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getTemplate(templateId, { signal: controller.signal })
      .then((template) => {
        if (!active) {
          return;
        }
        setState({ templateId, status: "ready", template, error: null });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        const apiError = toApiError(error);
        const isNotFound =
          apiError.kind === "http" && (apiError.status === 404 || apiError.code === "NOT_FOUND");
        setState({
          templateId,
          status: isNotFound ? "not-found" : "error",
          template: null,
          error: apiError,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [templateId, reloadToken]);

  const retry = useCallback(() => {
    setState({ templateId, status: "loading", template: null, error: null });
    setReloadToken((token) => token + 1);
  }, [templateId]);

  // 路由参数变化后、新请求返回前，不展示上一个模板的内容。
  const isPending = state.templateId !== templateId;
  const status: DetailStatus = isPending ? "loading" : state.status;
  const template = isPending ? null : state.template;
  const error = isPending ? null : state.error;

  if (status === "loading") {
    return <TemplateDetailSkeleton />;
  }

  if (status === "not-found") {
    return <TemplateNotFound />;
  }

  if (status === "error" && error) {
    return <TemplateLoadError error={error} onRetry={retry} />;
  }

  if (!template) {
    return <TemplateDetailSkeleton />;
  }

  return (
    <article className={styles.detail}>
      <Link href="/" className={styles.backLink}>
        <span aria-hidden="true">←</span> 返回模板列表
      </Link>

      <header className={styles.hero}>
        <div className={styles.coverFrame}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 封面域名由 NEXT_PUBLIC_API_BASE_URL 在运行时决定，无法预配置 next/image 的 remotePatterns。 */}
          <img
            className={styles.cover}
            src={assetUrl(template.coverUrl)}
            alt={`${template.title}模板封面`}
            width={800}
            height={600}
          />
        </div>

        <div className={styles.info}>
          <span className={styles.category}>{template.category.name}</span>
          <h1 className={styles.title}>{template.title}</h1>
          <p className={styles.description}>{template.description}</p>

          <dl className={styles.requirements} aria-label="素材要求">
            <div className={styles.requirement}>
              <dt>图片数量</dt>
              <dd>需 {template.requiredImageCount} 张</dd>
            </div>
            <div className={styles.requirement}>
              <dt>支持格式</dt>
              <dd>{formatMimeTypes(template.acceptedMimeTypes)}</dd>
            </div>
            <div className={styles.requirement}>
              <dt>单张上限</dt>
              <dd>{formatFileSize(template.maxFileSizeBytes)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <TemplateUploadForm
        key={userId ?? "anonymous"}
        template={template}
        userId={userId}
        onSubmitted={onSubmitted}
      />
    </article>
  );
}

function TemplateDetailSkeleton() {
  return (
    <div className={styles.detail} aria-busy="true" aria-label="模板详情加载中">
      <p className="srOnly" role="status">
        正在加载模板详情…
      </p>
      <div className={styles.skeletonBack} aria-hidden="true" />
      <div className={styles.hero} aria-hidden="true">
        <div className={`${styles.coverFrame} ${styles.skeletonCover}`} />
        <div className={styles.info}>
          <span className={styles.skeletonLineShort} />
          <span className={styles.skeletonTitle} />
          <span className={styles.skeletonLineWide} />
          <span className={styles.skeletonLineWide} />
          <div className={styles.skeletonRequirements} />
        </div>
      </div>
      <div className={styles.skeletonSlots} aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => (
          <span key={index} className={styles.skeletonSlot} />
        ))}
      </div>
    </div>
  );
}

function TemplateNotFound() {
  return (
    <div className={styles.statePanel}>
      <span className={styles.stateMark} aria-hidden="true">
        404
      </span>
      <h1 className={styles.stateTitle}>模板不存在</h1>
      <p className={styles.stateText}>这个模板可能已下架，或链接地址有误。</p>
      <Link href="/" className={styles.primaryButton}>
        返回模板列表
      </Link>
    </div>
  );
}

function TemplateLoadError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div className={styles.statePanel} role="alert">
      <span className={styles.stateMark} aria-hidden="true">
        !
      </span>
      <h1 className={styles.stateTitle}>模板加载失败</h1>
      <p className={styles.stateText}>{error.message}</p>
      <div className={styles.stateActions}>
        <button type="button" className={styles.primaryButton} onClick={onRetry}>
          重试加载模板
        </button>
        <Link href="/" className={styles.secondaryButton}>
          返回模板列表
        </Link>
      </div>
    </div>
  );
}
