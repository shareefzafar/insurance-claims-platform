package com.insureco.claims.dto.response;

import com.insureco.claims.domain.Claim;
import com.insureco.claims.domain.ClaimStatus;
import com.insureco.claims.domain.ClaimType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ClaimResponse — outbound DTO.
 *
 * Record: immutable by default — no setters, all fields final.
 * Static factory method from(Claim) keeps mapping logic in one place (DRY).
 */
public record ClaimResponse(
    String        claimId,
    String        policyId,
    ClaimType     type,
    ClaimStatus   status,
    BigDecimal    amount,
    String        description,
    String        holderName,
    String        holderEmail,
    LocalDateTime submittedAt,
    LocalDateTime lastUpdatedAt
) {
    /**
     * DRY: mapping from domain to DTO in ONE place.
     * If Claim adds a new field, update here — not in 5 different controllers.
     */
    public static ClaimResponse from(Claim claim) {
        return new ClaimResponse(
            claim.getId(),
            claim.getPolicyId(),
            claim.getType(),
            claim.getStatus(),
            claim.getAmount(),
            claim.getDescription(),
            claim.getPolicyHolder().getFullName(),
            claim.getPolicyHolder().getEmail(),
            claim.getSubmittedAt(),
            claim.getLastUpdatedAt()
        );
    }
}
