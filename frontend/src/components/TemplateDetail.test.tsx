import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskDTO } from "@/lib/types";
import { createTaskEntry } from "@/lib/tasks/taskReducer";
import {
  deferred,
  installFetch,
  jsonResponse,
  makeAsset,
  makeTask,
  travelPostcardDetail,
} from "@/test/fixtures";

import { TemplateDetail } from "./TemplateDetail";

let previewCounter = 0;

const createObjectURL = vi.fn(() => {
  const url = `blob:preview-${previewCounter}`;
  previewCounter += 1;
  return url;
});
const revokeObjectURL = vi.fn();

beforeEach(() => {
  previewCounter = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });
});

function renderDetail(
  props: {
    templateId?: string;
    userId?: number | null;
    onSubmitted?: (task: TaskDTO) => void;
  } = {},
) {
  return render(
    <TemplateDetail
      templateId={props.templateId ?? "demo-postcard"}
      userId={props.userId === undefined ? 1 : props.userId}
      onSubmitted={props.onSubmitted}
    />,
  );
}

function installDetailFetch(
  options: {
    template?: () => Promise<Response>;
    upload?: (init?: RequestInit) => Promise<Response>;
    submit?: (init?: RequestInit) => Promise<Response>;
  } = {},
) {
  return installFetch((url, init) => {
    if (url.pathname.startsWith("/api/templates/")) {
      return options.template?.() ?? Promise.resolve(jsonResponse(travelPostcardDetail));
    }
    if (url.pathname === "/api/assets") {
      return options.upload?.(init) ?? Promise.resolve(jsonResponse(makeAsset(101), { status: 201 }));
    }
    if (url.pathname === "/api/tasks") {
      return options.submit?.(init) ?? Promise.resolve(jsonResponse(makeTask(), { status: 202 }));
    }
    return Promise.resolve(jsonResponse({ code: "NOT_FOUND", message: "未知接口" }, { status: 404 }));
  });
}

function pngFile(name = "photo.png", size = 512): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("TemplateDetail", () => {
  it("加载中显示骨架，随后展示模板信息与上传位", async () => {
    installDetailFetch();

    renderDetail();

    expect(screen.getByText("正在加载模板详情…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "旅行明信片", level: 1 })).toBeInTheDocument();

    expect(screen.getByText("上传图片，模拟生成一张明信片")).toBeInTheDocument();
    expect(screen.getByText("需 2 张")).toBeInTheDocument();
    expect(screen.getByText("JPG / PNG")).toBeInTheDocument();
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.getByLabelText("上传第 1 张图片")).toBeInTheDocument();
    expect(screen.getByLabelText("上传第 2 张图片")).toBeInTheDocument();
  });

  it("类型或大小不合法时不发上传请求，并显示错误", async () => {
    let uploadCalls = 0;
    installDetailFetch({
      upload: () => {
        uploadCalls += 1;
        return Promise.resolve(jsonResponse(makeAsset(101), { status: 201 }));
      },
    });

    renderDetail();
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });

    const firstInput = screen.getByLabelText("上传第 1 张图片");
    fireEvent.change(firstInput, {
      target: { files: [new File(["text"], "note.txt", { type: "text/plain" })] },
    });

    expect(await screen.findByText(/不支持该文件类型/)).toBeInTheDocument();
    expect(uploadCalls).toBe(0);

    fireEvent.change(firstInput, {
      target: { files: [pngFile("big.png", 2048)] },
    });

    expect(await screen.findByText(/不能超过/)).toBeInTheDocument();
    expect(uploadCalls).toBe(0);
  });

  it("上传失败时显示后端 message，重试后可以成功", async () => {
    let uploadCalls = 0;
    const uploadCapture: { form: FormData | null; userId: string | null } = {
      form: null,
      userId: null,
    };
    installDetailFetch({
      upload: (init) => {
        uploadCalls += 1;
        uploadCapture.form = init?.body as FormData;
        uploadCapture.userId = new Headers(init?.headers).get("X-User-Id");
        if (uploadCalls === 1) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "上传接口暂时不可用" },
              { status: 500, statusText: "Internal Server Error" },
            ),
          );
        }
        return Promise.resolve(jsonResponse(makeAsset(101), { status: 201 }));
      },
    });

    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });

    const firstInput = screen.getByLabelText("上传第 1 张图片");
    expect(firstInput).toHaveAttribute("accept", "image/jpeg,image/png");
    await user.upload(firstInput, pngFile());

    expect(await screen.findByText("上传接口暂时不可用")).toBeInTheDocument();
    expect(uploadCalls).toBe(1);
    expect(uploadCapture.form?.get("templateId")).toBe("demo-postcard");
    expect(uploadCapture.form?.get("file")).toBeInstanceOf(File);
    expect(uploadCapture.userId).toBe("1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "重试上传第 1 张图片" }));

    await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());
    expect(uploadCalls).toBe(2);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("移除上传位时释放 ObjectURL 并清空", async () => {
    const user = userEvent.setup();
    installDetailFetch();

    renderDetail();
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });
    await user.upload(screen.getByLabelText("上传第 1 张图片"), pngFile());
    await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "移除第 1 张图片" }));

    await waitFor(() => expect(screen.getByText("0 / 2 已上传")).toBeInTheDocument());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
    expect(screen.getByLabelText("上传第 1 张图片")).toBeInTheDocument();
  });

  it("替换上传位时释放旧预览并上传新文件", async () => {
    const user = userEvent.setup();
    installDetailFetch();

    renderDetail();
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });
    await user.upload(screen.getByLabelText("上传第 1 张图片"), pngFile("one.png"));
    await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());

    await user.upload(screen.getByLabelText("上传第 1 张图片"), pngFile("two.png"));
    await waitFor(() => expect(screen.getByText("two.png")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("全部上传完成前提交不可用；提交中按钮禁用且不会重复提交", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn<(task: TaskDTO) => void>();
    const submitDeferred = deferred<Response>();
    let uploadCalls = 0;
    let submitCalls = 0;
    let submittedBody: { templateId: string; assetIds: number[] } | null = null;

    installDetailFetch({
      upload: () => {
        uploadCalls += 1;
        return Promise.resolve(jsonResponse(makeAsset(100 + uploadCalls), { status: 201 }));
      },
      submit: (init) => {
        submitCalls += 1;
        submittedBody = JSON.parse(String(init?.body)) as {
          templateId: string;
          assetIds: number[];
        };
        return submitDeferred.promise;
      },
    });

    renderDetail({ onSubmitted });
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });

    const submitButton = screen.getByRole("button", { name: "提交制作任务" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/还缺 2 张图片/)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("上传第 1 张图片"), pngFile("one.png"));
    await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/还缺 1 张图片/)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("上传第 2 张图片"), pngFile("two.png"));
    await waitFor(() => expect(screen.getByText("2 / 2 已上传")).toBeInTheDocument());

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    const submittingButton = await screen.findByRole("button", { name: "提交中…" });
    expect(submittingButton).toBeDisabled();
    expect(submitCalls).toBe(1);

    await user.click(submittingButton);
    expect(submitCalls).toBe(1);

    const task = makeTask(42);
    await act(async () => {
      submitDeferred.resolve(jsonResponse(task, { status: 202 }));
    });

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(task));
    await waitFor(() => expect(screen.getByText("0 / 2 已上传")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "提交制作任务" })).toBeDisabled();
    expect(screen.getByLabelText("上传第 1 张图片")).toBeInTheDocument();
    expect(submittedBody).toEqual({
      templateId: "demo-postcard",
      assetIds: [101, 102],
    });
  });

  it("提交成功后清空上传位，可以连续提交多个任务", async () => {
    const user = userEvent.setup();
    let uploadCalls = 0;
    let submitCalls = 0;
    const submittedTasks: TaskDTO[] = [];

    installDetailFetch({
      upload: () => {
        uploadCalls += 1;
        return Promise.resolve(jsonResponse(makeAsset(100 + uploadCalls), { status: 201 }));
      },
      submit: () => {
        submitCalls += 1;
        return Promise.resolve(jsonResponse(makeTask(41 + submitCalls), { status: 202 }));
      },
    });

    renderDetail({ onSubmitted: (task) => submittedTasks.push(task) });
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });

    const uploadPair = async () => {
      await user.upload(screen.getByLabelText("上传第 1 张图片"), pngFile("first.png"));
      await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());
      await user.upload(screen.getByLabelText("上传第 2 张图片"), pngFile("second.png"));
      await waitFor(() => expect(screen.getByText("2 / 2 已上传")).toBeInTheDocument());
    };

    await uploadPair();
    await user.click(screen.getByRole("button", { name: "提交制作任务" }));
    await waitFor(() => expect(submittedTasks).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("0 / 2 已上传")).toBeInTheDocument());

    await uploadPair();
    await user.click(screen.getByRole("button", { name: "提交制作任务" }));
    await waitFor(() => expect(submittedTasks).toHaveLength(2));

    expect(submittedTasks.map((task) => task.id)).toEqual([42, 43]);
    expect(submitCalls).toBe(2);
  });

  it("有 submittedTasks 时显示本页会话任务卡片", async () => {
    installDetailFetch();
    const entry = createTaskEntry(
      makeTask(42, { status: "RUNNING", stage: "CHECKING" }),
    );

    render(
      <TemplateDetail
        templateId="demo-postcard"
        userId={1}
        submittedTasks={[entry]}
        onRetryTask={() => undefined}
      />,
    );

    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });
    expect(await screen.findByText("本次提交的任务")).toBeInTheDocument();
    expect(screen.getByLabelText("素材检查：进行中")).toBeInTheDocument();
  });

  it("模板不存在时显示专门的提示并返回列表", async () => {    installDetailFetch({
      template: () =>
        Promise.resolve(
          jsonResponse({ code: "NOT_FOUND", message: "模板不存在" }, { status: 404 }),
        ),
    });

    renderDetail({ templateId: "missing-template" });

    expect(await screen.findByRole("heading", { name: "模板不存在" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回模板列表" })).toHaveAttribute("href", "/");
    expect(screen.queryByLabelText("上传第 1 张图片")).not.toBeInTheDocument();
  });

  it("模板加载失败后可以重试", async () => {
    let templateCalls = 0;
    installDetailFetch({
      template: () => {
        templateCalls += 1;
        if (templateCalls === 1) {
          return Promise.resolve(
            jsonResponse(
              { code: "INTERNAL_ERROR", message: "模板服务暂时不可用" },
              { status: 500, statusText: "Internal Server Error" },
            ),
          );
        }
        return Promise.resolve(jsonResponse(travelPostcardDetail));
      },
    });

    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText("模板服务暂时不可用")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试加载模板" }));

    expect(await screen.findByRole("heading", { name: "旅行明信片", level: 1 })).toBeInTheDocument();
    expect(templateCalls).toBe(2);
  });

  it("切换用户时清空上传位并释放 ObjectURL", async () => {
    const user = userEvent.setup();
    installDetailFetch();

    const { rerender } = renderDetail({ userId: 1 });
    await screen.findByRole("heading", { name: "旅行明信片", level: 1 });
    await user.upload(screen.getByLabelText("上传第 1 张图片"), pngFile());
    await waitFor(() => expect(screen.getByText("1 / 2 已上传")).toBeInTheDocument());

    rerender(
      <TemplateDetail templateId="demo-postcard" userId={2} />,
    );

    await waitFor(() => expect(screen.getByText("0 / 2 已上传")).toBeInTheDocument());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
    expect(screen.queryByText("1 / 2 已上传")).not.toBeInTheDocument();
  });
});
