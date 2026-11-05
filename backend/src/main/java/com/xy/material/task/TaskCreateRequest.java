package com.xy.material.task;

import java.util.List;

/**
 * POST /api/tasks 请求体，assetIds 的顺序即上传位顺序。
 */
public record TaskCreateRequest(String templateId, List<Long> assetIds) {
}
