import type { AssetDTO } from "@/lib/types";

export interface UploadAssetInput {
  templateId: string;
  file: File;
  userId: number;
  signal?: AbortSignal;
}

/**
 * F2 / M7 实现：POST /api/assets（multipart/form-data）。
 * F1 只保留函数签名，避免详情页提前接入半成品上传逻辑。
 */
export function uploadAsset(input: UploadAssetInput): Promise<AssetDTO> {
  void input;
  return Promise.reject(new Error("uploadAsset 将在 F2（M7）中实现"));
}
