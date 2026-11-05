package com.xy.material.task;

import com.xy.material.asset.AssetStorage;
import java.io.IOException;
import org.springframework.stereotype.Component;

/**
 * FINALIZING：把示例结果图复制到 APP_STORAGE_DIR/results/{uuid}.png，返回结果 URL。
 */
@Component
public class FinalizingStageHandler implements StageHandler {

    private final AssetStorage assetStorage;

    public FinalizingStageHandler(AssetStorage assetStorage) {
        this.assetStorage = assetStorage;
    }

    @Override
    public TaskStage stage() {
        return TaskStage.FINALIZING;
    }

    @Override
    public void execute(StageContext context) {
        String productIdentifier = context.getProductIdentifier();
        if (productIdentifier == null || productIdentifier.isBlank()) {
            throw new StageExecutionException("结果整理失败：未获得生成产物");
        }
        try {
            context.setResultUrl(assetStorage.copySampleResult(productIdentifier));
        } catch (IOException exception) {
            throw new StageExecutionException("结果整理失败：无法生成结果文件");
        }
    }
}
