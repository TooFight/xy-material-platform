"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, isAbortError, toApiError } from "@/lib/api/client";
import { listTasks } from "@/lib/api/tasks";
import { useTasks } from "@/lib/tasks/TaskProvider";
import { createTaskEntry } from "@/lib/tasks/taskReducer";
import type { TaskDTO } from "@/lib/types";

import { RefreshIcon } from "./icons";
import { TaskCard } from "./TaskCard";
import styles from "./HistoryView.module.css";

const PAGE_SIZE = 10;

type HistoryStatus = "loading" | "ready" | "error";

interface HistoryState {
  status: HistoryStatus;
  items: TaskDTO[];
  total: number;
  /** 最近一次成功加载的页码；用于保留旧列表和判断首次失败/翻页失败。 */
  loadedPage: number | null;
  error: ApiError | null;
  errorPage: number | null;
}

export interface HistoryViewProps {
  userId: number | null;
}

export function HistoryView({ userId }: HistoryViewProps) {
  const { byId, upsertTask, retry } = useTasks();
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<HistoryState>({
    status: "loading",
    items: [],
    total: 0,
    loadedPage: null,
    error: null,
    errorPage: null,
  });

  useEffect(() => {
    if (userId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    listTasks({ userId, page, size: PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        setState({
          status: "ready",
          items: response.items,
          total: response.total,
          loadedPage: response.page,
          error: null,
          errorPage: null,
        });
        for (const task of response.items) {
          upsertTask(task);
        }
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        // 保留上一次成功加载的 items/total/loadedPage；渲染时再决定整页错误还是列表上方错误。
        setState((previous) => ({
          ...previous,
          status: "error",
          error: toApiError(error),
          errorPage: page,
        }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, page, reloadToken, upsertTask]);

  // 不先清空 items：同一页刷新失败时仍能看到上次成功的结果。
  const retryLoad = useCallback(() => {
    setState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
      errorPage: null,
    }));
    setReloadToken((token) => token + 1);
  }, []);

  const goToPage = (nextPage: number) => {
    if (nextPage === page) {
      return;
    }
    setPage(nextPage);
    setState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
      errorPage: null,
    }));
  };

  const goBack = () => {
    if (state.loadedPage === null) {
      return;
    }
    setPage(state.loadedPage);
    setState((previous) => ({
      ...previous,
      status: "ready",
      error: null,
      errorPage: null,
    }));
  };

  const hasLoaded = state.loadedPage !== null;
  const isCurrentPageLoaded = state.loadedPage === page;
  const isInitialLoading = state.status === "loading" && !hasLoaded;
  const isNewPageLoading = state.status === "loading" && hasLoaded && !isCurrentPageLoaded;
  const isRefreshingCurrent =
    state.status === "loading" && hasLoaded && isCurrentPageLoaded;
  const isPageSwitchLoading = state.status === "ready" && !isCurrentPageLoaded;
  const isReady = state.status === "ready" && isCurrentPageLoaded;
  const isSamePageError =
    state.status === "error" &&
    state.errorPage === page &&
    hasLoaded &&
    isCurrentPageLoaded;
  const isInitialError =
    state.status === "error" && state.errorPage === page && !hasLoaded;
  const isNewPageError =
    state.status === "error" &&
    state.errorPage === page &&
    hasLoaded &&
    !isCurrentPageLoaded;

  const showSkeleton = isInitialLoading || isNewPageLoading || isPageSwitchLoading;
  const showList = isReady || isRefreshingCurrent || isSamePageError;
  const items = showList ? state.items : [];
  const entries = items.map((task) => byId[task.id] ?? createTaskEntry(task));
  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

  return (
    <section className={styles.view} aria-labelledby="history-heading">
      <header className={styles.header}>
        <div>
          <h1 id="history-heading" className={styles.title}>
            我的作品
          </h1>
          <p className={styles.lede}>这里会显示你提交过的制作任务，处理中的任务会自动更新。</p>
        </div>
        <div className={styles.headerActions}>
          {hasLoaded && state.total > 0 && (
            <span className={styles.count}>共 {state.total} 个任务</span>
          )}
          {hasLoaded && (
            <button
              type="button"
              className={styles.refreshButton}
              onClick={retryLoad}
              disabled={state.status === "loading"}
              aria-label="刷新"
              title="刷新"
            >
              <RefreshIcon size={17} />
            </button>
          )}
        </div>
      </header>

      {isInitialError && state.error && (
        <div className={styles.statePanel} role="alert">
          <span className={styles.stateMark} aria-hidden="true">
            !
          </span>
          <h2 className={styles.stateTitle}>历史记录加载失败</h2>
          <p className={styles.stateText}>{state.error.message}</p>
          <button type="button" className={styles.primaryButton} onClick={retryLoad}>
            重试
          </button>
        </div>
      )}

      {isNewPageError && state.error && (
        <div className={styles.statePanel} role="alert">
          <span className={styles.stateMark} aria-hidden="true">
            !
          </span>
          <h2 className={styles.stateTitle}>这一页加载失败</h2>
          <p className={styles.stateText}>{state.error.message}</p>
          <div className={styles.stateActions}>
            {state.loadedPage !== null && (
              <button type="button" className={styles.secondaryButton} onClick={goBack}>
                返回上一页
              </button>
            )}
            <button type="button" className={styles.primaryButton} onClick={retryLoad}>
              重试
            </button>
          </div>
        </div>
      )}

      {showSkeleton && (
        <div className={styles.loading}>
          <p className="srOnly" role="status">
            正在加载历史记录…
          </p>
          <ul className={styles.list} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className={styles.skeletonCard} />
            ))}
          </ul>
        </div>
      )}

      {isSamePageError && state.error && (
        <div className={styles.inlineError} role="alert">
          <span>历史记录刷新失败，已保留上次结果：{state.error.message}</span>
          <button type="button" onClick={retryLoad}>
            重试
          </button>
        </div>
      )}

      {isRefreshingCurrent && (
        <p className={styles.refreshing} role="status">
          正在刷新历史记录…
        </p>
      )}

      {isReady && entries.length === 0 && (
        <div className={styles.statePanel} role="status">
          <span className={styles.stateMark} aria-hidden="true">
            ○
          </span>
          <h2 className={styles.stateTitle}>还没有作品</h2>
          <p className={styles.stateText}>去模板库挑一个模板，提交你的第一个制作任务吧。</p>
          <Link href="/" className={styles.primaryButton}>
            浏览模板
          </Link>
        </div>
      )}

      {showList && entries.length > 0 && (
        <>
          <ul
            className={styles.list}
            aria-label="历史任务"
            aria-busy={isRefreshingCurrent}
          >
            {entries.map((entry) => (
              <li key={entry.task.id} className={styles.item}>
                <TaskCard entry={entry} onRetry={retry} />
              </li>
            ))}
          </ul>

          {state.total > PAGE_SIZE && (
            <nav className={styles.pagination} aria-label="历史记录分页">
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || state.status === "loading"}
              >
                上一页
              </button>
              <span className={styles.pageInfo}>
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || state.status === "loading"}
              >
                下一页
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
