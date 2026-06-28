package com.allianz.claims.pattern.strategy;

import com.allianz.claims.domain.Claim;

/**
 * STRATEGY PATTERN — NotificationStrategy
 *
 * SOLID principles demonstrated:
 *  - OCP: New notification channels (WhatsApp, Push) = new class only.
 *         ClaimsService never changes.
 *  - DIP: ClaimsService depends on THIS interface, not EmailNotificationStrategy
 *         or SmsNotificationStrategy. Spring injects the concrete impl.
 *  - ISP: Interface has only ONE method — exactly what every client needs.
 *         No stubbing of unused methods.
 *
 * COMPOSITION OVER INHERITANCE:
 *  Bad approach: BaseNotificationService → EmailNotificationService → SmsNotificationService
 *  - Fragile base class problem
 *  - Changing BaseNotificationService breaks all subclasses
 *  - Cannot swap strategies at runtime
 *
 *  Good approach (this): ClaimsService has-a NotificationStrategy
 *  - Each strategy is independently testable
 *  - Strategies are swappable at runtime
 *  - Adding a new strategy = zero changes to existing code
 */
public interface NotificationStrategy {

    /**
     * Send a notification about a claim status change.
     *
     * CONTRACT (LSP): Every implementation MUST send the notification.
     * A no-op implementation violates LSP — callers trust the contract.
     *
     * @param claim the claim that triggered the notification
     * @return NotificationResult with delivery status and message ID
     */
    NotificationResult notify(Claim claim);

    /**
     * Human-readable name of this strategy — useful for logging and metrics.
     */
    String getChannelName();
}
