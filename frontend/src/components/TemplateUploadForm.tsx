"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { ApiError, isAbortError, toApiError } from "@/lib/api/client";
import { uploadAsset } from "@/lib/api/assets";
import { submitTask } from "@/lib/api/tasks";
import type { TaskDTO, TemplateDetail } from "@/lib/types";
import { validateFile } from "@/lib/upload/fileValidation";
import {
  createUploadSlots,
  uploadSlotsReducer,
  type UploadSlotsState,
} from "@/lib/upload/uploadSlotReducer";

import { UploadSlot } from "./UploadSlot";
import styles from "./TemplateUploadForm.module.css";

export interface TemplateUploadFormProps {
  template: TemplateDetail;
  userId: number | null;
  onSubmitted?: (task: TaskDTO) => void;
}

export function TemplateUploadForm({ template, userId, onSubmitted }: TemplateUploadFormProps) {
  const [slots, dispatch] = useReducer(
    uploadSlotsReducer,
    template.requiredImageCount,
    createUploadSlots,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  const controllersRef = useRef<Array<AbortController | null>>([]);
  const submitControllerRef = useRef<AbortController | null>(null);
  const uploadIdRef = useRef(0);
  const slotsRef = useRef<UploadSlotsState>(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  // 组件卸载、切换用户（父级用 key 重建）时中止请求并释放所有预览地址。
  useEffect(() => {
    return () => {
      for (const controller of controllersRef.current) {
        controller?.abort();
      }
      controllersRef.current = [];
      submitControllerRef.current?.abort();
      submitControllerRef.current = null;

      for (const slot of slotsRef.current) {
        if (slot.previewUrl) {
          URL.revokeObjectURL(slot.previewUrl);
        }
      }
    };
  }, []);

  const nextUploadId = (): number => {
    uploadIdRef.current += 1;
    return uploadIdRef.current;
  };

  const abortSlotUpload = (index: number) => {
    const controller = controllersRef.current[index];
    if (controller) {
      controller.abort();
      controllersRef.current[index] = null;
    }
  };

  const startUpload = (
    index: number,
    file: File,
    previewUrl: string,
    uploadId: number,
    currentUserId: number,
  ) => {
    const controller = new AbortController();
    controllersRef.current[index] = controller;

    uploadAsset({
      templateId: template.id,
      file,
      userId: currentUserId,
      signal: controller.signal,
    })
      .then((asset) => {
        if (controller.signal.aborted) {
          return;
        }
        dispatch({ type: "succeed", index, uploadId, asset });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        dispatch({ type: "fail", index, uploadId, error: toApiError(error).message });
      })
      .finally(() => {
        if (controllersRef.current[index] === controller) {
          controllersRef.current[index] = null;
        }
      });
  };

  const handleFileSelected = (index: number, file: File) => {
    const slot = slots[index];
    abortSlotUpload(index);

    if (slot?.previewUrl) {
      URL.revokeObjectURL(slot.previewUrl);
    }

    const validationError = validateFile(file, template);
    if (validationError) {
      dispatch({ type: "reject", index, error: validationError });
      return;
    }

    if (userId === null) {
      dispatch({ type: "reject", index, error: "正在确认身份，请稍后再试。" });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const uploadId = nextUploadId();
    dispatch({ type: "start", index, file, previewUrl, uploadId });
    startUpload(index, file, previewUrl, uploadId, userId);
  };

  const handleRetry = (index: number) => {
    const slot = slots[index];
    if (!slot?.file || userId === null) {
      return;
    }

    abortSlotUpload(index);
    const previewUrl = slot.previewUrl ?? URL.createObjectURL(slot.file);
    const uploadId = nextUploadId();
    dispatch({ type: "start", index, file: slot.file, previewUrl, uploadId });
    startUpload(index, slot.file, previewUrl, uploadId, userId);
  };

  const handleRemove = (index: number) => {
    const slot = slots[index];
    abortSlotUpload(index);
    if (slot?.previewUrl) {
      URL.revokeObjectURL(slot.previewUrl);
    }
    dispatch({ type: "clear", index });
  };

  // 202 受理后清空上传位、释放预览，表单恢复可用，可连续提交下一个任务。
  const resetSlots = () => {
    for (const controller of controllersRef.current) {
      controller?.abort();
    }
    controllersRef.current = [];
    for (const slot of slots) {
      if (slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
    }
    dispatch({ type: "reset", count: template.requiredImageCount });
    setSubmitError(null);
  };

  const uploadedCount = slots.filter(
    (slot) => slot.status === "uploaded" && slot.asset !== null,
  ).length;
  const allReady = slots.length > 0 && uploadedCount === slots.length;
  const remaining = slots.length - uploadedCount;
  const inputsDisabled = userId === null || submitting;
  const canSubmit = allReady && userId !== null && !submitting;

  const handleSubmit = () => {
    if (!canSubmit || userId === null) {
      return;
    }

    const assetIds = slots
      .map((slot) => slot.asset?.id)
      .filter((assetId): assetId is number => typeof assetId === "number");
    if (assetIds.length !== slots.length) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const controller = new AbortController();
    submitControllerRef.current = controller;

    void submitTask({
      templateId: template.id,
      assetIds,
      userId,
      signal: controller.signal,
    })
      .then((task) => {
        if (controller.signal.aborted) {
          return;
        }
        resetSlots();
        onSubmitted?.(task);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setSubmitError(toApiError(error));
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }
        if (submitControllerRef.current === controller) {
          submitControllerRef.current = null;
        }
        setSubmitting(false);
      });
  };

  return (
    <section className={styles.form} aria-labelledby="upload-heading">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>素材上传</p>
          <h2 id="upload-heading" className={styles.heading}>
            上传 {template.requiredImageCount} 张图片
          </h2>
        </div>
        <p className={styles.progress} aria-live="polite">
          {uploadedCount} / {slots.length} 已上传
        </p>
      </div>

      <ul className={styles.slotGrid} aria-label="图片上传位">
        {slots.map((slot, index) => (
          <UploadSlot
            key={index}
            index={index}
            slot={slot}
            template={template}
            disabled={inputsDisabled}
            onFileSelected={handleFileSelected}
            onRetry={handleRetry}
            onRemove={handleRemove}
          />
        ))}
      </ul>

      {userId === null && (
        <p className={styles.identityHint} role="status">
          正在确认身份，确认后才能上传图片。
        </p>
      )}

      {submitError && (
        <p className={styles.submitError} role="alert">
          {submitError.message}
        </p>
      )}

      <div className={styles.submitBar}>
        <div className={styles.submitInfo} aria-live="polite">
          {allReady ? (
            <span>素材已就绪，可以提交。</span>
          ) : (
            <span>还缺 {remaining} 张图片。</span>
          )}
          {!allReady && <span className={styles.submitHint}>全部上传完成后才能提交。</span>}
        </div>
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? "提交中…" : "提交制作任务"}
        </button>
      </div>
    </section>
  );
}
