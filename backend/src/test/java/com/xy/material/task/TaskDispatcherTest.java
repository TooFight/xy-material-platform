package com.xy.material.task;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;

@ExtendWith(MockitoExtension.class)
class TaskDispatcherTest {

    @Mock
    private TaskExecutor taskExecutor;

    @Mock
    private TaskPipelineRunner taskPipelineRunner;

    @Mock
    private TaskStore taskStore;

    @Test
    void rejectedTaskIsMarkedFailedWithBusyReason() {
        TaskDispatcher dispatcher = new TaskDispatcher(taskExecutor, taskPipelineRunner, taskStore);
        doThrow(new TaskRejectedException("queue full"))
                .when(taskExecutor).execute(any(Runnable.class));

        dispatcher.dispatch(42L);

        verify(taskStore).fail(42L, null, "系统繁忙，任务未能进入处理队列");
        verifyNoInteractions(taskPipelineRunner);
    }
}
