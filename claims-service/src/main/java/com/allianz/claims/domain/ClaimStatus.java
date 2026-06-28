package com.allianz.claims.domain;

/**
 * Claim status lifecycle.
 * Valid transitions: SUBMITTED → UNDER_REVIEW → APPROVED or REJECTED
 *                   APPROVED → PAID
 */
public enum ClaimStatus {
    SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID;

    /**
     * DRY: transition validation in ONE place.
     * SRP: status knows its own valid transitions.
     */
    public boolean canTransitionTo(ClaimStatus next) {
        return switch (this) {
            case SUBMITTED    -> next == UNDER_REVIEW || next == REJECTED;
            case UNDER_REVIEW -> next == APPROVED || next == REJECTED;
            case APPROVED     -> next == PAID;
            case REJECTED, PAID -> false; // terminal states
        };
    }
}
