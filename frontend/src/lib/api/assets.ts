import type { AssetDTO } from "@/lib/types";

import { request } from "./client";

export interface UploadAssetInput {
  templateId: string;
  file: File;
  userId: number;
  signal?: AbortSignal;
}

/**
 * POST /api/assets：每个上传位单独上传一张图片。
 * 由浏览器自动设置 multipart boundary，client 不会覆盖 Content-Type。
 */
export function uploadAsset(input: UploadAssetInput): Promise<AssetDTO> {
  const body = new FormData();
  body.append("templateId", input.templateId);
  body.append("file", input.file);

  return request<AssetDTO>("/api/assets", {
    method: "POST",
    body,
    userId: input.userId,
    signal: input.signal,
  });
}
