package com.allianz.claims.pattern.observer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;


// ─────────────────────────────────────────────────────────────────────────────
// OBSERVER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OBSERVER PATTERN — ClaimEventListener (the Observer interface)
 *
 * DIP: ClaimEventPublisher depends on THIS interface, not on concrete listeners.
 * OCP: Add new listeners (e.g. FraudCheckListener) without changing the publisher.
 * ISP: One focused method — every listener only implements what it needs.
 *
 * REAL-WORLD USE: Spring's @EventListener is exactly this pattern built into the framework.
 * We implement it manually here to demonstrate the mechanism for interviews.
 */
interface ClaimEventListener {

    /**
     * Called when a claim status changes.
     * CONTRACT: This method must not throw exceptions — failures should be handled internally.
     *           A failing listener must not break other listeners or the publishing flow.
     */
    void onClaimStatusChanged(ClaimEvent event);

    /**
     * Returns true if this listener should handle the given event.
     * Allows selective listening — e.g. AuditListener handles ALL events,
     * but ApprovalNotificationListener only handles APPROVED events.
     */
    default boolean supports(ClaimEvent event) {
        return true; // by default: listen to all events
    }
}



// ─────────────────────────────────────────────────────────────────────────────
// CONCRETE LISTENERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Audit Log Listener — records every status change for compliance.
 * Handles ALL events (no filter override).
 *
 * SRP: Only responsibility = audit logging.
 */
@Slf4j
@Component
class AuditLogListener implements ClaimEventListener {

    @Override
    public void onClaimStatusChanged(ClaimEvent event) {
        // In production: persist to audit_log table or send to CloudWatch
        log.info("AUDIT | ClaimId={} | {} -> {} | PolicyId={} | At={}",
            event.getClaimId(),
            event.getOldStatus(),
            event.getNewStatus(),
            event.getPolicyId(),
            event.getOccurredAt());
    }
}


/**
 * Approval Notification Listener — sends notification ONLY when claim is APPROVED.
 * Demonstrates the supports() filter — selective listening.
 *
 * DRY: Status check is in one place (supports method), not scattered across the handler.
 */
@Slf4j
@Component
class ApprovalNotificationListener implements ClaimEventListener {

    @Override
    public boolean supports(ClaimEvent event) {
        // Only handle APPROVED transitions — ignores SUBMITTED, REJECTED, etc.
        return "APPROVED".equals(event.getNewStatus());
    }

    @Override
    public void onClaimStatusChanged(ClaimEvent event) {
        // In production: trigger the NotificationStrategy here
        log.info("APPROVAL NOTIFICATION | Claim {} approved | Notifying holder at {}",
            event.getClaimId(), event.getHolderEmail());
    }
}


/**
 * Rejection Listener — handles REJECTED claims specifically.
 * Could trigger a review workflow or counter-offer process.
 */
@Slf4j
@Component
class RejectionListener implements ClaimEventListener {

    @Override
    public boolean supports(ClaimEvent event) {
        return "REJECTED".equals(event.getNewStatus());
    }

    @Override
    public void onClaimStatusChanged(ClaimEvent event) {
        log.info("REJECTION HANDLER | Claim {} rejected | Initiating appeals process for {}",
            event.getClaimId(), event.getHolderEmail());
        // In production: create an AppealTask, notify the review team, etc.
    }
}
