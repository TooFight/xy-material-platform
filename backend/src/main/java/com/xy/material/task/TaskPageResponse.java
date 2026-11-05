package com.xy.material.task;

import java.util.List;

/**
 * active=false 时的分页任务列表响应：{ items, page, size, total }。
 */
public record TaskPageResponse(List<TaskDto> items, int page, int size, long total) {
}
