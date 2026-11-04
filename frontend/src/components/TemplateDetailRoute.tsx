"use client";

import { useState } from "react";

import { useTasks } from "@/lib/tasks/TaskProvider";
import { createTaskEntry } from "@/lib/tasks/taskReducer";
import type { TaskDTO } from "@/lib/types";
import { useUser } from "@/lib/user/UserProvider";

import { TemplateDetail } from "./TemplateDetail";

/**
 * 把当前身份和全局任务表注入详情页。
 * 本页提交成功的任务会立即 addTask 并加入 session 列表；切换用户时 key 重建，session 清空。
 */
export function TemplateDetailRoute({ templateId }: { templateId: string }) {
  const { userId } = useUser();

  if (userId === null) {
    return <TemplateDetail templateId={templateId} userId={null} />;
  }

  return <DetailSession key={userId} templateId={templateId} userId={userId} />;
}

function DetailSession({ templateId, userId }: { templateId: string; userId: number }) {
  const { addTask, byId, retry } = useTasks();
  const [sessionTasks, setSessionTasks] = useState<TaskDTO[]>([]);

  const handleSubmitted = (task: TaskDTO) => {
    addTask(task);
    setSessionTasks((previous) => [task, ...previous]);
  };

  const submittedEntries = sessionTasks.map((task) => byId[task.id] ?? createTaskEntry(task));

  return (
    <TemplateDetail
      templateId={templateId}
      userId={userId}
      onSubmitted={handleSubmitted}
      submittedTasks={submittedEntries}
      onRetryTask={retry}
    />
  );
}
