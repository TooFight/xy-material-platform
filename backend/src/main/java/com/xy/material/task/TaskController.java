package com.xy.material.task;

import com.xy.material.user.CurrentUser;
import com.xy.material.user.User;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TaskController {

    private final TaskService taskService;
    private final TaskQueryService taskQueryService;

    public TaskController(TaskService taskService, TaskQueryService taskQueryService) {
        this.taskService = taskService;
        this.taskQueryService = taskQueryService;
    }

    @PostMapping("/tasks")
    public ResponseEntity<TaskDto> submit(@RequestBody TaskCreateRequest request,
                                          @CurrentUser User currentUser) {
        TaskDto task = taskService.submit(currentUser.getId(), request);
        return ResponseEntity.accepted()
                .location(URI.create("/api/tasks/" + task.id()))
                .body(task);
    }

    @GetMapping("/tasks/{id}")
    public TaskDto get(@PathVariable("id") long id, @CurrentUser User currentUser) {
        return taskQueryService.getTask(currentUser.getId(), id);
    }

    /**
     * active=true 时不分页、忽略 page/size；否则返回分页对象。
     */
    @GetMapping("/tasks")
    public ResponseEntity<?> list(
            @RequestParam(name = "active", defaultValue = "false") boolean active,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @CurrentUser User currentUser) {
        if (active) {
            return ResponseEntity.ok(taskQueryService.listActive(currentUser.getId()));
        }
        return ResponseEntity.ok(taskQueryService.listPage(currentUser.getId(), page, size));
    }
}
