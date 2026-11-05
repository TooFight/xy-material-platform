package com.xy.material.task;

import com.xy.material.common.ApiException;
import com.xy.material.files.FileUrlSigner;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 任务查询服务：只执行 SELECT，不触发任何状态推进。
 */
@Service
@Transactional(readOnly = true)
public class TaskQueryService {

    private final TaskMapper taskMapper;
    private final TaskAssetMapper taskAssetMapper;
    private final StageLogMapper stageLogMapper;
    private final FileUrlSigner fileUrlSigner;

    public TaskQueryService(TaskMapper taskMapper,
                            TaskAssetMapper taskAssetMapper,
                            StageLogMapper stageLogMapper,
                            FileUrlSigner fileUrlSigner) {
        this.taskMapper = taskMapper;
        this.taskAssetMapper = taskAssetMapper;
        this.stageLogMapper = stageLogMapper;
        this.fileUrlSigner = fileUrlSigner;
    }

    public TaskDto getTask(long userId, long taskId) {
        TaskRow task = taskMapper.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("任务不存在"));
        if (task.getUserId() != userId) {
            throw ApiException.notFound("任务不存在");
        }
        List<TaskAssetRow> assets = taskAssetMapper.findByTaskIds(List.of(taskId));
        List<StageLogRow> stages = stageLogMapper.findByTaskId(taskId);
        return TaskDto.from(task, assets, stages, fileUrlSigner);
    }

    public TaskListResponse listActive(long userId) {
        List<TaskRow> tasks = taskMapper.findActiveByUserId(userId);
        return new TaskListResponse(toDtos(tasks));
    }

    public TaskPageResponse listPage(long userId, int page, int size) {
        if (page < 1) {
            throw ApiException.validation("page 必须大于等于 1");
        }
        if (size < 1 || size > 100) {
            throw ApiException.validation("size 必须在 1~100 之间");
        }
        long total = taskMapper.countByUserId(userId);
        long offset = (long) (page - 1) * size;
        List<TaskRow> tasks = taskMapper.findPage(userId, offset, size);
        return new TaskPageResponse(toDtos(tasks), page, size, total);
    }

    private List<TaskDto> toDtos(List<TaskRow> tasks) {
        if (tasks.isEmpty()) {
            return List.of();
        }
        List<Long> taskIds = tasks.stream().map(TaskRow::getId).toList();
        List<TaskAssetRow> assetRows = taskAssetMapper.findByTaskIds(taskIds);
        Map<Long, List<TaskAssetRow>> assetsByTask = assetRows.stream()
                .collect(Collectors.groupingBy(TaskAssetRow::getTaskId));
        return tasks.stream()
                .map(task -> TaskDto.from(
                        task,
                        assetsByTask.getOrDefault(task.getId(), List.of()),
                        null,
                        fileUrlSigner))
                .toList();
    }
}
