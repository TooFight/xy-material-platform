package com.xy.material.task;

import com.xy.material.asset.AssetStorage;
import com.xy.material.asset.ImageFileType;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * CHECKING：重新读取任务素材，确认文件存在、大小和类型与 assets 记录一致。
 */
@Component
public class CheckingStageHandler implements StageHandler {

    private final TaskAssetMapper taskAssetMapper;
    private final AssetStorage assetStorage;

    public CheckingStageHandler(TaskAssetMapper taskAssetMapper, AssetStorage assetStorage) {
        this.taskAssetMapper = taskAssetMapper;
        this.assetStorage = assetStorage;
    }

    @Override
    public TaskStage stage() {
        return TaskStage.CHECKING;
    }

    @Override
    public void execute(StageContext context) {
        TaskRow task = context.getTask();
        List<TaskAssetRow> assets = taskAssetMapper.findByTaskIds(List.of(task.getId()));
        if (assets.isEmpty()) {
            throw new StageExecutionException("素材检查未通过：任务没有关联素材");
        }

        for (TaskAssetRow asset : assets) {
            String storageKey = asset.getStorageKey();
            if (!assetStorage.exists(storageKey)) {
                throw new StageExecutionException(
                        "素材检查未通过：素材文件不存在（assetId=" + asset.getAssetId() + "）");
            }

            Path path;
            try {
                path = assetStorage.resolveFile(storageKey);
            } catch (RuntimeException exception) {
                throw new StageExecutionException("素材检查未通过：素材文件不可读");
            }

            try {
                long actualSize = Files.size(path);
                if (actualSize != asset.getSizeBytes()) {
                    throw new StageExecutionException(
                            "素材检查未通过：素材大小与记录不一致（assetId=" + asset.getAssetId() + "）");
                }

                ImageFileType detectedType;
                try (InputStream input = Files.newInputStream(path)) {
                    detectedType = ImageFileType.detect(input).orElse(null);
                }
                if (detectedType == null || !detectedType.mimeType().equals(asset.getMimeType())) {
                    throw new StageExecutionException(
                            "素材检查未通过：素材类型与记录不一致（assetId=" + asset.getAssetId() + "）");
                }
            } catch (IOException exception) {
                throw new StageExecutionException("素材检查未通过：无法读取素材文件");
            }
        }
    }
}
