package com.xy.material.task;

/**
 * 单次任务执行期间在三个阶段之间传递的数据。
 */
public class StageContext {

    private final TaskRow task;
    private String productIdentifier;
    private String resultUrl;

    public StageContext(TaskRow task) {
        this.task = task;
    }

    public TaskRow getTask() {
        return task;
    }

    public String getProductIdentifier() {
        return productIdentifier;
    }

    public void setProductIdentifier(String productIdentifier) {
        this.productIdentifier = productIdentifier;
    }

    public String getResultUrl() {
        return resultUrl;
    }

    public void setResultUrl(String resultUrl) {
        this.resultUrl = resultUrl;
    }
}
