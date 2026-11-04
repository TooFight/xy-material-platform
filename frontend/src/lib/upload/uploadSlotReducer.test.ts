import { describe, expect, it } from "vitest";

import { makeAsset } from "@/test/fixtures";

import { createUploadSlots, uploadSlotsReducer, type UploadSlotsState } from "./uploadSlotReducer";

const firstFile = new File(["first"], "first.jpg", { type: "image/jpeg" });
const secondFile = new File(["second"], "second.jpg", { type: "image/jpeg" });
const firstAsset = makeAsset(101);
const secondAsset = makeAsset(102);

function startedState(): UploadSlotsState {
  return uploadSlotsReducer(createUploadSlots(2), {
    type: "start",
    index: 0,
    file: firstFile,
    previewUrl: "blob:first",
    uploadId: 1,
  });
}

describe("uploadSlotsReducer", () => {
  it("创建指定数量的独立空上传位", () => {
    const slots = createUploadSlots(3);

    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => slot.status === "empty")).toBe(true);
    expect(slots[0]).not.toBe(slots[1]);
  });

  it("start：empty → uploading，保存文件、预览和 uploadId", () => {
    const next = startedState();

    expect(next[0]).toMatchObject({
      status: "uploading",
      file: firstFile,
      previewUrl: "blob:first",
      asset: null,
      error: null,
      uploadId: 1,
    });
    expect(next[1].status).toBe("empty");
  });

  it("succeed：uploading → uploaded，并保存服务端素材", () => {
    const next = uploadSlotsReducer(startedState(), {
      type: "succeed",
      index: 0,
      uploadId: 1,
      asset: firstAsset,
    });

    expect(next[0]).toMatchObject({
      status: "uploaded",
      asset: firstAsset,
      file: firstFile,
      previewUrl: "blob:first",
      error: null,
      uploadId: null,
    });
  });

  it("fail：uploading → error，保留文件与预览以便重试", () => {
    const next = uploadSlotsReducer(startedState(), {
      type: "fail",
      index: 0,
      uploadId: 1,
      error: "上传接口暂时不可用",
    });

    expect(next[0]).toMatchObject({
      status: "error",
      error: "上传接口暂时不可用",
      file: firstFile,
      previewUrl: "blob:first",
      asset: null,
      uploadId: null,
    });
  });

  it("reject：前端校验失败时清空文件和预览并显示错误", () => {
    const next = uploadSlotsReducer(startedState(), {
      type: "reject",
      index: 0,
      error: "不支持该文件类型",
    });

    expect(next[0]).toMatchObject({
      status: "error",
      error: "不支持该文件类型",
      file: null,
      previewUrl: null,
      asset: null,
      uploadId: null,
    });
  });

  it("替换后旧 uploadId 的成功/失败响应都不会写入", () => {
    const uploadingOld = uploadSlotsReducer(startedState(), {
      type: "start",
      index: 0,
      file: secondFile,
      previewUrl: "blob:second",
      uploadId: 2,
    });

    const staleSuccess = uploadSlotsReducer(uploadingOld, {
      type: "succeed",
      index: 0,
      uploadId: 1,
      asset: firstAsset,
    });
    expect(staleSuccess).toBe(uploadingOld);

    const staleFailure = uploadSlotsReducer(uploadingOld, {
      type: "fail",
      index: 0,
      uploadId: 1,
      error: "旧请求失败",
    });
    expect(staleFailure).toBe(uploadingOld);

    const currentSuccess = uploadSlotsReducer(uploadingOld, {
      type: "succeed",
      index: 0,
      uploadId: 2,
      asset: secondAsset,
    });
    expect(currentSuccess[0]).toMatchObject({
      status: "uploaded",
      asset: secondAsset,
      file: secondFile,
      previewUrl: "blob:second",
    });
  });

  it("移除后迟到的上传响应不会写回", () => {
    const cleared = uploadSlotsReducer(startedState(), { type: "clear", index: 0 });
    expect(cleared[0].status).toBe("empty");

    const stale = uploadSlotsReducer(cleared, {
      type: "succeed",
      index: 0,
      uploadId: 1,
      asset: firstAsset,
    });

    expect(stale).toBe(cleared);
    expect(stale[0].status).toBe("empty");
  });

  it("一个上传位的状态变化不影响其他上传位", () => {
    let state = createUploadSlots(2);
    state = uploadSlotsReducer(state, {
      type: "start",
      index: 0,
      file: firstFile,
      previewUrl: "blob:first",
      uploadId: 1,
    });
    state = uploadSlotsReducer(state, {
      type: "start",
      index: 1,
      file: secondFile,
      previewUrl: "blob:second",
      uploadId: 2,
    });
    state = uploadSlotsReducer(state, {
      type: "succeed",
      index: 0,
      uploadId: 1,
      asset: firstAsset,
    });

    expect(state[0].status).toBe("uploaded");
    expect(state[1]).toMatchObject({ status: "uploading", file: secondFile, uploadId: 2 });
  });

  it("reset：切换用户/重新初始化时全部清空", () => {
    const state = uploadSlotsReducer(startedState(), { type: "reset", count: 2 });

    expect(state).toHaveLength(2);
    expect(state.every((slot) => slot.status === "empty")).toBe(true);
    expect(state.every((slot) => slot.previewUrl === null)).toBe(true);
  });
});
