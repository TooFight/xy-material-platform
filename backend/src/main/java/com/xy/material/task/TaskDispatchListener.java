package com.xy.material.task;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 只在受理事务提交后投递，避免工作线程读到未提交的任务。
 */
@Component
public class TaskDispatchListener {

    private final TaskDispatcher taskDispatcher;

    public TaskDispatchListener(TaskDispatcher taskDispatcher) {
        this.taskDispatcher = taskDispatcher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTaskAccepted(TaskAcceptedEvent event) {
        taskDispatcher.dispatch(event.taskId());
    }
}
