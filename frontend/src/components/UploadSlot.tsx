"use client";

import { useRef, type ChangeEvent } from "react";

import type { TemplateDetail } from "@/lib/types";
import { formatFileSize, formatMimeTypes } from "@/lib/upload/fileValidation";
import type { UploadSlotState } from "@/lib/upload/uploadSlotReducer";

import styles from "./UploadSlot.module.css";

export interface UploadSlotProps {
  index: number;
  slot: UploadSlotState;
  template: TemplateDetail;
  disabled: boolean;
  onFileSelected: (index: number, file: File) => void;
  onRetry: (index: number) => void;
  onRemove: (index: number) => void;
}

export function UploadSlot({
  index,
  slot,
  template,
  disabled,
  onFileSelected,
  onRetry,
  onRemove,
}: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slotNumber = index + 1;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // 允许用户重新选择同一个文件时仍然触发 change。
    event.currentTarget.value = "";
    if (file) {
      onFileSelected(index, file);
    }
  };

  const openPicker = () => {
    inputRef.current?.click();
  };

  const statusText =
    slot.status === "empty"
      ? "未选择图片"
      : slot.status === "uploading"
        ? "上传中…"
        : slot.status === "uploaded"
          ? "已上传"
          : (slot.error ?? "上传失败");

  return (
    <li className={styles.slot} data-status={slot.status} aria-busy={slot.status === "uploading"}>
      <label className={styles.previewLabel}>
        <input
          ref={inputRef}
          className={styles.fileInput}
          type="file"
          accept={template.acceptedMimeTypes.join(",")}
          aria-label={`上传第 ${slotNumber} 张图片`}
          onChange={handleChange}
          disabled={disabled}
        />

        {slot.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: 预览地址只在浏览器本地有效，next/image 无法优化。
          <img
            className={styles.preview}
            src={slot.previewUrl}
            alt={`第 ${slotNumber} 张图片预览`}
          />
        ) : (
          <span className={styles.emptyPreview} aria-hidden="true">
            <span className={styles.plus}>＋</span>
            <span className={styles.emptyTitle}>上传第 {slotNumber} 张图片</span>
            <span className={styles.emptyHint}>
              {formatMimeTypes(template.acceptedMimeTypes)} · ≤{" "}
              {formatFileSize(template.maxFileSizeBytes)}
            </span>
          </span>
        )}

        {slot.status === "uploading" && (
          <span className={styles.overlay} aria-hidden="true">
            <span className={styles.spinner} />
            上传中…
          </span>
        )}
        {slot.status === "uploaded" && (
          <span className={styles.badge} aria-hidden="true">
            已上传
          </span>
        )}
      </label>

      <div className={styles.footer}>
        <span className={styles.fileName}>{slot.file?.name ?? `第 ${slotNumber} 张图片`}</span>
        <div className={styles.actions}>
          {(slot.status === "uploaded" || slot.status === "uploading") && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={openPicker}
              disabled={disabled}
              aria-label={`替换第 ${slotNumber} 张图片`}
            >
              替换
            </button>
          )}
          {slot.status === "error" && slot.file && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => onRetry(index)}
              disabled={disabled}
              aria-label={`重试上传第 ${slotNumber} 张图片`}
            >
              重试
            </button>
          )}
          {slot.status !== "empty" && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => onRemove(index)}
              disabled={disabled}
              aria-label={`移除第 ${slotNumber} 张图片`}
            >
              移除
            </button>
          )}
        </div>
      </div>

      <p
        className={slot.status === "error" ? `${styles.status} ${styles.statusError}` : styles.status}
        aria-live="polite"
      >
        {statusText}
      </p>
    </li>
  );
}
