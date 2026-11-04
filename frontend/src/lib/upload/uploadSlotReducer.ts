import type { AssetDTO } from "@/lib/types";

export type UploadSlotStatus = "empty" | "uploading" | "uploaded" | "error";

export interface UploadSlotState {
  status: UploadSlotStatus;
  file: File | null;
  previewUrl: string | null;
  asset: AssetDTO | null;
  error: string | null;
  /** 当前这一轮上传的序号；旧响应通过不匹配的 uploadId 被丢弃。 */
  uploadId: number | null;
}

export type UploadSlotsState = UploadSlotState[];

export type UploadSlotsAction =
  | { type: "start"; index: number; file: File; previewUrl: string; uploadId: number }
  | { type: "succeed"; index: number; uploadId: number; asset: AssetDTO }
  | { type: "fail"; index: number; uploadId: number; error: string }
  | { type: "reject"; index: number; error: string }
  | { type: "clear"; index: number }
  | { type: "reset"; count: number };

export function createEmptyUploadSlot(): UploadSlotState {
  return {
    status: "empty",
    file: null,
    previewUrl: null,
    asset: null,
    error: null,
    uploadId: null,
  };
}

export function createUploadSlots(count: number): UploadSlotsState {
  return Array.from({ length: Math.max(0, count) }, () => createEmptyUploadSlot());
}

function isValidIndex(state: UploadSlotsState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.length;
}

/**
 * 纯函数 reducer：一次操作只改动目标上传位，其他上传位保持原对象。
 * succeed/fail 必须匹配当前 uploadId，替换或移除后的迟到响应会被忽略。
 */
export function uploadSlotsReducer(
  state: UploadSlotsState,
  action: UploadSlotsAction,
): UploadSlotsState {
  switch (action.type) {
    case "start": {
      if (!isValidIndex(state, action.index)) {
        return state;
      }
      const next = [...state];
      next[action.index] = {
        status: "uploading",
        file: action.file,
        previewUrl: action.previewUrl,
        asset: null,
        error: null,
        uploadId: action.uploadId,
      };
      return next;
    }

    case "succeed": {
      const slot = state[action.index];
      if (!slot || slot.uploadId !== action.uploadId || slot.status !== "uploading") {
        return state;
      }
      const next = [...state];
      next[action.index] = {
        ...slot,
        status: "uploaded",
        asset: action.asset,
        error: null,
        uploadId: null,
      };
      return next;
    }

    case "fail": {
      const slot = state[action.index];
      if (!slot || slot.uploadId !== action.uploadId || slot.status !== "uploading") {
        return state;
      }
      const next = [...state];
      next[action.index] = {
        ...slot,
        status: "error",
        asset: null,
        error: action.error,
        uploadId: null,
      };
      return next;
    }

    case "reject": {
      if (!isValidIndex(state, action.index)) {
        return state;
      }
      const next = [...state];
      next[action.index] = {
        ...createEmptyUploadSlot(),
        status: "error",
        error: action.error,
      };
      return next;
    }

    case "clear": {
      if (!isValidIndex(state, action.index)) {
        return state;
      }
      const next = [...state];
      next[action.index] = createEmptyUploadSlot();
      return next;
    }

    case "reset":
      return createUploadSlots(action.count);

    default:
      return state;
  }
}
