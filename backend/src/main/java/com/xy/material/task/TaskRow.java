package com.xy.material.task;

import java.time.LocalDateTime;

/**
 * tasks 表的查询结果行，同时携带模板展示字段和 FINALIZING 需要的示例结果路径。
 */
public class TaskRow {

    private Long id;
    private long userId;
    private String templateId;
    private TaskStatus status;
    private TaskStage stage;
    private TaskStage failedStage;
    private String failureReason;
    private String resultUrl;
    private String simFailStage;
    private int simStageDelayMs;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime updatedAt;
    private String templateTitle;
    private String templateCoverUrl;
    private String sampleResultPath;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public long getUserId() {
        return userId;
    }

    public void setUserId(long userId) {
        this.userId = userId;
    }

    public String getTemplateId() {
        return templateId;
    }

    public void setTemplateId(String templateId) {
        this.templateId = templateId;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public TaskStage getStage() {
        return stage;
    }

    public void setStage(TaskStage stage) {
        this.stage = stage;
    }

    public TaskStage getFailedStage() {
        return failedStage;
    }

    public void setFailedStage(TaskStage failedStage) {
        this.failedStage = failedStage;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public String getResultUrl() {
        return resultUrl;
    }

    public void setResultUrl(String resultUrl) {
        this.resultUrl = resultUrl;
    }

    public String getSimFailStage() {
        return simFailStage;
    }

    public void setSimFailStage(String simFailStage) {
        this.simFailStage = simFailStage;
    }

    public int getSimStageDelayMs() {
        return simStageDelayMs;
    }

    public void setSimStageDelayMs(int simStageDelayMs) {
        this.simStageDelayMs = simStageDelayMs;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(LocalDateTime finishedAt) {
        this.finishedAt = finishedAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getTemplateTitle() {
        return templateTitle;
    }

    public void setTemplateTitle(String templateTitle) {
        this.templateTitle = templateTitle;
    }

    public String getTemplateCoverUrl() {
        return templateCoverUrl;
    }

    public void setTemplateCoverUrl(String templateCoverUrl) {
        this.templateCoverUrl = templateCoverUrl;
    }

    public String getSampleResultPath() {
        return sampleResultPath;
    }

    public void setSampleResultPath(String sampleResultPath) {
        this.sampleResultPath = sampleResultPath;
    }

    public boolean isTerminal() {
        return status != null && status.isTerminal();
    }
}
