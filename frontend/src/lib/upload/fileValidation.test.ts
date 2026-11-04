import { describe, expect, it } from "vitest";

import { formatFileSize, formatMimeTypes, validateFile } from "./fileValidation";

const requirement = {
  acceptedMimeTypes: ["image/jpeg", "image/png"],
  maxFileSizeBytes: 1024,
};

describe("fileValidation", () => {
  it("格式化文件类型和大小", () => {
    expect(formatMimeTypes(["image/jpeg", "image/png", "image/webp"])).toBe("JPG / PNG / WebP");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("先校验类型：类型不合法时即使超大也返回类型错误", () => {
    const file = new File([new Uint8Array(4096)], "note.txt", { type: "text/plain" });

    expect(validateFile(file, requirement)).toContain("不支持该文件类型");
  });

  it("类型合法但超过大小上限时返回大小错误", () => {
    const file = new File([new Uint8Array(2048)], "big.png", { type: "image/png" });

    expect(validateFile(file, requirement)).toContain("不能超过");
  });

  it("空文件返回错误", () => {
    const file = new File([], "empty.png", { type: "image/png" });

    expect(validateFile(file, requirement)).toContain("为空");
  });

  it("合法文件返回 null", () => {
    const file = new File([new Uint8Array(512)], "ok.png", { type: "image/png" });

    expect(validateFile(file, requirement)).toBeNull();
  });
});
