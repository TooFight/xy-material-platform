package com.xy.material.task;

import java.util.List;

/**
 * active=true 时的任务列表响应：{ items: [...] }。
 */
public record TaskListResponse(List<TaskDto> items) {
}
