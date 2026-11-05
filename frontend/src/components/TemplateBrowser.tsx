"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ApiError, isAbortError, toApiError } from "@/lib/api/client";
import { listTemplateCategories, listTemplates } from "@/lib/api/templates";
import type { TemplateCategory, TemplateSummary } from "@/lib/types";

import { TemplateCard } from "./TemplateCard";
import styles from "./TemplateBrowser.module.css";

type LoadStatus = "loading" | "ready" | "error";

interface TemplatesState {
  category: string | null;
  status: LoadStatus;
  items: TemplateSummary[];
  error: ApiError | null;
}

export interface TemplateBrowserProps {
  category: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function TemplateBrowser({ category, onCategoryChange }: TemplateBrowserProps) {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [categoriesStatus, setCategoriesStatus] = useState<LoadStatus>("loading");
  const [categoriesError, setCategoriesError] = useState<ApiError | null>(null);
  const [categoriesReloadToken, setCategoriesReloadToken] = useState(0);

  const [templatesState, setTemplatesState] = useState<TemplatesState>({
    category,
    status: "loading",
    items: [],
    error: null,
  });
  const [templatesReloadToken, setTemplatesReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    listTemplateCategories({ signal: controller.signal })
      .then((items) => {
        if (!active) {
          return;
        }
        setCategories(items);
        setCategoriesStatus("ready");
        setCategoriesError(null);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setCategoriesStatus("error");
        setCategoriesError(toApiError(error));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [categoriesReloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    listTemplates({ category, signal: controller.signal })
      .then((items) => {
        if (!active) {
          return;
        }
        setTemplatesState({ category, status: "ready", items, error: null });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setTemplatesState({ category, status: "error", items: [], error: toApiError(error) });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [category, templatesReloadToken]);

  const retryTemplates = useCallback(() => {
    setTemplatesState((previous) => ({
      category: previous.category,
      status: "loading",
      items: [],
      error: null,
    }));
    setTemplatesReloadToken((token) => token + 1);
  }, []);

  const retryCategories = useCallback(() => {
    setCategoriesStatus("loading");
    setCategoriesError(null);
    setCategoriesReloadToken((token) => token + 1);
  }, []);

  // 分类切换后、新请求返回前，旧数据不属于当前分类，按加载中处理，避免闪出旧卡片。
  const isCategoryPending = templatesState.category !== category;
  const templatesStatus: LoadStatus = isCategoryPending ? "loading" : templatesState.status;
  const templates = isCategoryPending ? [] : templatesState.items;
  const templatesError = isCategoryPending ? null : templatesState.error;

  return (
    <section className={styles.browser} aria-labelledby="template-heading" aria-busy={templatesStatus === "loading"}>
      <BrowserIntro />

      <div className={styles.toolbar}>
        <nav className={styles.categories} aria-label="模板分类">
          <CategoryButton active={category === null} onClick={() => onCategoryChange(null)}>
            全部
          </CategoryButton>
          {categories.map((item) => (
            <CategoryButton
              key={item.code}
              active={category === item.code}
              onClick={() => onCategoryChange(item.code)}
            >
              {item.name}
            </CategoryButton>
          ))}
        </nav>

        {categoriesStatus === "loading" && (
          <span className={styles.categoryState} role="status">
            分类加载中…
          </span>
        )}
        {categoriesStatus === "error" && (
          <div className={styles.categoryError} role="alert">
            <span>{categoriesError?.message ?? "分类加载失败"}</span>
            <button type="button" onClick={retryCategories}>
              重新加载分类
            </button>
          </div>
        )}
      </div>

      {templatesStatus === "loading" && <TemplateGridSkeleton />}

      {templatesStatus === "error" && templatesError && (
        <div className={styles.statePanel} role="alert">
          <span className={styles.stateMark} aria-hidden="true">
            !
          </span>
          <h2 className={styles.stateTitle}>模板加载失败</h2>
          <p className={styles.stateText}>{templatesError.message}</p>
          <button type="button" className={styles.retryButton} onClick={retryTemplates}>
            重试
          </button>
        </div>
      )}

      {templatesStatus === "ready" && templates.length === 0 && (
        <div className={styles.statePanel} role="status">
          <span className={styles.stateMark} aria-hidden="true">
            ○
          </span>
          <h2 className={styles.stateTitle}>该分类下暂无模板</h2>
          <p className={styles.stateText}>
            {category ? "换一个分类看看，或查看全部模板。" : "模板正在准备中，请稍后再来。"}
          </p>
          {category && (
            <button type="button" className={styles.secondaryButton} onClick={() => onCategoryChange(null)}>
              查看全部模板
            </button>
          )}
        </div>
      )}

      {templatesStatus === "ready" && templates.length > 0 && (
        <ul className={styles.grid} aria-label="模板列表">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** 页面 Suspense fallback：与真实列表使用同一套骨架结构，避免 hydration 时跳动。 */
export function TemplateBrowserSkeleton() {
  return (
    <section className={styles.browser} aria-busy="true" aria-label="模板列表加载中">
      <BrowserIntro />
      <div className={styles.categorySkeleton} aria-hidden="true" />
      <TemplateGridSkeleton />
    </section>
  );
}

// 参考界面没有可见的页面大标题；保留给读屏用户的 h1。
function BrowserIntro() {
  return (
    <h1 id="template-heading" className="srOnly">
      模板列表
    </h1>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={styles.categoryButton} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function TemplateGridSkeleton() {
  return (
    <div className={styles.loading}>
      <p className="srOnly" role="status">
        正在加载模板…
      </p>
      <ul className={styles.grid} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <li key={index} className={styles.skeletonCard} />
        ))}
      </ul>
    </div>
  );
}
