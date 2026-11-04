"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, isAbortError, toApiError } from "@/lib/api/client";
import { listTasks } from "@/lib/api/tasks";
import { useTasks } from "@/lib/tasks/TaskProvider";
import { createTaskEntry } from "@/lib/tasks/taskReducer";
import type { TaskDTO } from "@/lib/types";

import { TaskCard } from "./TaskCard";
import styles from "./HistoryView.module.css";

const PAGE_SIZE = 10;

type HistoryStatus = "loading" | "ready" | "error";

interface HistoryState {
  page: number;
  status: HistoryStatus;
  items: TaskDTO[];
  total: number;
  error: ApiError | null;
}

export interface HistoryViewProps {
  userId: number | null;
}

export function HistoryView({ userId }: HistoryViewProps) {
  const { byId, upsertTask, retry } = useTasks();
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<HistoryState>({
    page: 1,
    status: "loading",
    items: [],
    total: 0,
    error: null,
  });

  useEffect(() => {
    if (userId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    listTasks({ userId, page, size: PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        if (!active) {
          return;
        }
        setState({
          page: response.page,
          status: "ready",
          items: response.items,
          total: response.total,
          error: null,
        });
        for (const task of response.items) {
          upsertTask(task);
        }
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setState({
          page,
          status: "error",
          items: [],
          total: 0,
          error: toApiError(error),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, page, reloadToken, upsertTask]);

  const retryLoad = useCallback(() => {
    setState((previous) => ({
      ...previous,
      page,
      status: "loading",
      items: [],
      error: null,
    }));
    setReloadToken((token) => token + 1);
  }, [page]);

  const isPagePending = state.page !== page;
  const status: HistoryStatus = isPagePending ? "loading" : state.status;
  const items = isPagePending ? [] : state.items;
  const total = state.total;
  const error = isPagePending ? null : state.error;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const entries = items.map((task) => byId[task.id] ?? createTaskEntry(task));

  return (
    <section className={styles.view} aria-labelledby="history-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>个人作品</p>
          <h1 id="history-heading" className={styles.title}>
            我的作品
          </h1>
          <p className={styles.lede}>这里会显示你提交过的制作任务，处理中的任务会自动更新。</p>
        </div>
        {status === "ready" && total > 0 && (
          <span className={styles.count}>共 {total} 个任务</span>
        )}
      </header>

      {status === "loading" && (
        <div className={styles.loading}>
          <p className="srOnly" role="status">
            正在加载历史记录…
          </p>
          <ul className={styles.list} aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index} className={styles.skeletonCard}>
                <span className={styles.skeletonTitle} />
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonBlock} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "error" && error && (
        <div className={styles.statePanel} role="alert">
          <span className={styles.stateMark} aria-hidden="true">
            !
          </span>
          <h2 className={styles.stateTitle}>历史记录加载失败</h2>
          <p className={styles.stateText}>{error.message}</p>
          <button type="button" className={styles.primaryButton} onClick={retryLoad}>
            重试
          </button>
        </div>
      )}

      {status === "ready" && entries.length === 0 && (
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

      {status === "ready" && entries.length > 0 && (
        <>
          <ul className={styles.list} aria-label="历史任务">
            {entries.map((entry) => (
              <li key={entry.task.id} className={styles.item}>
                <TaskCard entry={entry} onRetry={retry} />
              </li>
            ))}
          </ul>

          {total > PAGE_SIZE && (
            <nav className={styles.pagination} aria-label="历史记录分页">
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                上一页
              </button>
              <span className={styles.pageInfo}>
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
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
