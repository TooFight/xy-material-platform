const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

export interface FileRequirement {
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
}

export function formatMimeType(mimeType: string): string {
  return MIME_LABELS[mimeType] ?? mimeType.replace(/^image\//, "").toUpperCase();
}

export function formatMimeTypes(mimeTypes: string[]): string {
  return mimeTypes.map(formatMimeType).join(" / ");
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    const value = bytes / 1024;
    return `${Number.isInteger(value) ? value : value.toFixed(1)} KB`;
  }
  const value = bytes / (1024 * 1024);
  return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
}

/**
 * 前端体验层校验：先类型、后大小。服务端仍会按文件头魔数重新校验。
 * 返回 null 表示通过，否则返回可直接展示的中文错误。
 */
export function validateFile(file: File, requirement: FileRequirement): string | null {
  if (!requirement.acceptedMimeTypes.includes(file.type)) {
    return `不支持该文件类型，请选择 ${formatMimeTypes(requirement.acceptedMimeTypes)} 格式的图片。`;
  }
  if (file.size <= 0) {
    return "图片文件为空，请重新选择。";
  }
  if (file.size > requirement.maxFileSizeBytes) {
    return `图片大小不能超过 ${formatFileSize(requirement.maxFileSizeBytes)}，当前文件为 ${formatFileSize(file.size)}。`;
  }
  return null;
}
