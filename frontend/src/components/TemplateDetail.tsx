"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, assetUrl, isAbortError, toApiError } from "@/lib/api/client";
import { getTemplate } from "@/lib/api/templates";
import type { TaskDTO, TemplateDetail as TemplateDetailDTO } from "@/lib/types";
import type { TaskEntry } from "@/lib/tasks/taskReducer";
import { formatFileSize, formatMimeTypes } from "@/lib/upload/fileValidation";

import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { TaskCard } from "./TaskCard";
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
  /** 提交成功后由路由层 addTask，并把任务加入本页 session 列表。 */
  onSubmitted?: (task: TaskDTO) => void;
  /** 本页本次会话提交的任务，按最新在前。 */
  submittedTasks?: TaskEntry[];
  onRetryTask?: (taskId: number) => void;
}

export function TemplateDetail({
  templateId,
  userId,
  onSubmitted,
  submittedTasks,
  onRetryTask,
}: TemplateDetailProps) {
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

  const coverSrc = assetUrl(template.coverUrl);
  const tasks = submittedTasks ?? [];

  // UI-02 / UI-03：左栏制作面板，右栏本页提交的任务。
  return (
    <div className={styles.detail}>
      <article className={styles.makePanel} aria-labelledby="template-title">
        <header className={styles.titleRow}>
          <Link href="/" className={styles.backLink} aria-label="返回模板列表">
            <ChevronLeftIcon size={18} />
          </Link>
          <h1 id="template-title" className={styles.title}>
            {template.title}
          </h1>
        </header>

        <div className={styles.coverFrame}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 装饰性模糊底图，地址同封面。 */}
          <img className={styles.coverBackdrop} src={coverSrc} alt="" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element -- 封面域名由 NEXT_PUBLIC_API_BASE_URL 在运行时决定，无法预配置 next/image 的 remotePatterns。 */}
          <img
            className={styles.cover}
            src={coverSrc}
            alt={`${template.title}模板封面`}
            width={540}
            height={960}
          />
        </div>

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

        <TemplateUploadForm
          key={userId ?? "anonymous"}
          template={template}
          userId={userId}
          onSubmitted={onSubmitted}
        />
      </article>

      <section className={styles.recordsPanel} aria-labelledby="session-tasks-heading">
        <header className={styles.recordsHeader}>
          <h2 id="session-tasks-heading" className={styles.recordsTitle}>
            本次提交的任务
          </h2>
          <Link href="/history" className={styles.historyLink}>
            全部作品
            <ChevronRightIcon size={15} />
          </Link>
        </header>

        {tasks.length > 0 ? (
          <ul className={styles.recordsGrid} aria-label="本次提交的任务列表">
            {tasks.map((entry) => (
              <li key={entry.task.id} className={styles.recordsItem}>
                <TaskCard entry={entry} onRetry={onRetryTask ?? (() => undefined)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.recordsEmpty}>
            上传图片并提交后，制作任务会出现在这里。任务在后台处理，离开页面也不会中断。
          </p>
        )}
      </section>
    </div>
  );
}

function TemplateDetailSkeleton() {
  return (
    <div className={styles.detail} aria-busy="true" aria-label="模板详情加载中">
      <p className="srOnly" role="status">
        正在加载模板详情…
      </p>
      <div className={styles.makePanel} aria-hidden="true">
        <span className={styles.skeletonTitle} />
        <span className={`${styles.coverFrame} ${styles.skeletonBlock}`} />
        <span className={styles.skeletonLine} />
        <span className={`${styles.skeletonBlock} ${styles.skeletonUpload}`} />
        <span className={`${styles.skeletonBlock} ${styles.skeletonButton}`} />
      </div>
      <div className={styles.recordsPanel} aria-hidden="true">
        <span className={styles.skeletonTitle} />
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
