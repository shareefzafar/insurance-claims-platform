package com.allianz.claims.pattern.observer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * OBSERVER PATTERN — ClaimEventPublisher (the Subject / Observable)
 *
 * Maintains a list of listeners and notifies them when a claim changes.
 *
 * KEY POINTS:
 *  - Publisher does NOT import any concrete listener class (DIP)
 *  - Listeners can be added/removed at runtime
 *  - Each listener's failure is isolated — does not break other listeners
 *  - Copy-before-iterate prevents ConcurrentModificationException
 *    if a listener removes itself during notification
 */
@Slf4j
@Component
public class ClaimEventPublisher {

    private final List<ClaimEventListener> listeners = new ArrayList<>();

    /**
     * Register a listener. Called by Spring via constructor injection.
     */
    public ClaimEventPublisher(List<ClaimEventListener> listeners) {
        this.listeners.addAll(listeners);
        log.info("ClaimEventPublisher initialised with {} listeners", listeners.size());
    }

    /**
     * Publish a ClaimEvent to all registered listeners that support it.
     *
     * Each listener is called in a try/catch — one failing listener
     * does NOT break the others. This mirrors how Spring's ApplicationEventPublisher works.
     */
    public void publish(ClaimEvent event) {
        log.info("Publishing event: {}", event);

        // Copy before iterating — prevents ConcurrentModificationException
        // if a listener removes itself during notification (e.g. once-only listeners)
        new ArrayList<>(listeners).stream()
            .filter(listener -> listener.supports(event))
            .forEach(listener -> {
                try {
                    listener.onClaimStatusChanged(event);
                } catch (Exception e) {
                    // Isolated failure — one bad listener does not break others
                    log.error("Listener {} failed for event {}",
                        listener.getClass().getSimpleName(), event.getClaimId(), e);
                }
            });
    }
}

