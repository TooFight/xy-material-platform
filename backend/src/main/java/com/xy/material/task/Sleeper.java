package com.xy.material.task;

/**
 * 可注入的阶段耗时模拟器；测试可替换为 0 延迟或可控阻塞实现。
 */
public interface Sleeper {

    void sleep(long millis) throws InterruptedException;
}
