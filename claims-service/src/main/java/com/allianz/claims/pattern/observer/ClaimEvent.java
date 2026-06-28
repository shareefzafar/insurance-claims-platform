package com.allianz.claims.pattern.observer;

import com.allianz.claims.domain.Claim;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * Immutable event object published when a claim status changes.
 * Immutable because events represent facts — they happened and cannot be changed.
 */
@Getter
public final class ClaimEvent {

    private final String        claimId;
    private final String        policyId;
    private final String        oldStatus;
    private final String        newStatus;
    private final double        amount;
    private final String        holderEmail;
    private final LocalDateTime occurredAt;

    public ClaimEvent(Claim claim, String oldStatus) {
        this.claimId     = claim.getId();
        this.policyId    = claim.getPolicyId();
        this.oldStatus   = oldStatus;
        this.newStatus   = claim.getStatus().name();
        this.amount      = claim.getAmount().doubleValue();
        this.holderEmail = claim.getPolicyHolder().getEmail();
        this.occurredAt  = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return "ClaimEvent{claimId=" + claimId +
               ", " + oldStatus + " -> " + newStatus +
               ", at=" + occurredAt + "}";
    }
}

