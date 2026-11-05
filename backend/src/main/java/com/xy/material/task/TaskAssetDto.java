package com.xy.material.task;

/**
 * TaskDTO 中引用的素材，见 docs/api.md §5.1。
 */
public record TaskAssetDto(long id, int slotIndex, String url) {
}
