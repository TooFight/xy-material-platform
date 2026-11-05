package com.xy.material.task;

import org.springframework.stereotype.Component;

@Component
public class ThreadSleeper implements Sleeper {

    @Override
    public void sleep(long millis) throws InterruptedException {
        if (millis > 0) {
            Thread.sleep(millis);
        }
    }
}
