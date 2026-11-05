"use client";

import { useRef } from "react";

import { useUser } from "@/lib/user/UserProvider";

import { CheckIcon, ChevronRightIcon, CloseIcon, IdCardIcon, UserIcon } from "./icons";
import styles from "./UserSwitcher.module.css";

/**
 * 顶栏账号入口 + 「账号设置」对话框（参照 UI 参考图的 Account Settings 布局）。
 * 演示身份没有邮箱、密码、计费等数据，参考图里的这些条目替换为本项目真实存在的信息与操作。
 */
export function UserSwitcher() {
  const { users, userId, status, switchUser, reload } = useUser();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (status === "error") {
    return (
      <div className={styles.error} role="alert">
        <span>身份加载失败</span>
        <button type="button" onClick={reload}>
          重试
        </button>
      </div>
    );
  }

  const isLoading = status === "loading";
  const currentUser = users.find((user) => user.id === userId) ?? null;

  const openDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  };

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      triggerRef.current?.focus();
    }
  };

  const handleSwitch = (nextUserId: number) => {
    if (nextUserId !== userId) {
      switchUser(nextUserId);
    }
    closeDialog();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={openDialog}
        disabled={isLoading || users.length === 0}
        aria-haspopup="dialog"
        aria-label={
          currentUser ? `当前身份：${currentUser.displayName}，打开账号设置` : "打开账号设置"
        }
      >
        <UserIcon size={16} />
        <span className={styles.triggerName}>
          {isLoading ? "加载中…" : (currentUser?.displayName ?? "选择身份")}
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="account-dialog-title"
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDialog();
          }
        }}
      >
        <div className={styles.dialogInner}>
          <div className={styles.dialogHeader}>
            <h2 id="account-dialog-title">账号设置</h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeDialog}
              aria-label="关闭账号设置"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {currentUser && (
            <section className={styles.profile} aria-label="当前身份">
              <div className={styles.profileTop}>
                <span className={styles.profileAvatar} aria-hidden="true">
                  <UserIcon size={30} />
                </span>
                <div className={styles.profileText}>
                  <span className={styles.profileName}>{currentUser.displayName}</span>
                  <span className={styles.profileSub}>演示用户 · ID {currentUser.id}</span>
                </div>
              </div>
              <dl className={styles.profileRows}>
                <div className={styles.profileRow}>
                  <dt>用户名</dt>
                  <dd>{currentUser.username}</dd>
                </div>
                <div className={styles.profileRow}>
                  <dt>登录方式</dt>
                  <dd>演示身份，无需密码</dd>
                </div>
              </dl>
            </section>
          )}

          <section className={styles.group} aria-labelledby="account-switch-title">
            <h3 id="account-switch-title" className="srOnly">
              切换演示用户
            </h3>
            <ul className={styles.groupList}>
              {users.map((user) => {
                const isCurrent = user.id === userId;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      className={styles.groupItem}
                      aria-pressed={isCurrent}
                      onClick={() => handleSwitch(user.id)}
                    >
                      <span className={styles.itemIcon} aria-hidden="true">
                        {isCurrent ? <IdCardIcon size={22} /> : <UserIcon size={22} />}
                      </span>
                      <span className={styles.itemLabel}>
                        {isCurrent ? `当前身份：${user.displayName}` : `切换到 ${user.displayName}`}
                      </span>
                      {isCurrent ? (
                        <CheckIcon size={20} className={styles.itemCheck} />
                      ) : (
                        <ChevronRightIcon size={20} className={styles.itemChevron} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={styles.notice} aria-labelledby="account-notice-title">
            <h3 id="account-notice-title">关于演示身份</h3>
            <p>
              后端按请求头 X-User-Id 区分用户，任务、历史与素材只对本人可见。这是演示用的身份方案，没有密码和真正的鉴权。
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
