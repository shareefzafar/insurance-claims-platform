package com.allianz.claims.domain;

import com.allianz.claims.exception.InvalidClaimTransitionException;
import jakarta.persistence.*;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Claim — the aggregate root of the claims domain.
 *
 * BUILDER PATTERN:
 *  - Mandatory fields (policyId, amount, type, policyHolder) go in the Builder constructor
 *  - Optional fields (description, supportingDocumentUrl) have defaults
 *  - Validation happens in build() — you cannot create an invalid Claim
 *  - All fields are private with no setters for immutable fields
 *  - Status transitions are controlled via explicit methods (not setStatus)
 *
 * SRP:
 *  - Claim knows its own state and transition rules (canTransitionTo lives on ClaimStatus)
 *  - Claim does NOT send notifications, calculate payouts, or persist itself
 *
 * WHY NOT LOMBOK @Builder?
 *  Lombok @Builder does not enforce mandatory fields at compile time.
 *  Manual Builder: constructor takes mandatory fields — you cannot forget them.
 *  In production code use Lombok for brevity. Here: manual Builder for the interview demo.
 */
@Entity
@Table(name = "claims")
@Getter
public class Claim {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String policyId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ClaimType type;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "policy_holder_id")
    private PolicyHolder policyHolder;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ClaimStatus status;

    @Column(length = 1000)
    private String description;

    private String supportingDocumentUrl;

    @Column(nullable = false, updatable = false)
    private LocalDateTime submittedAt;

    private LocalDateTime lastUpdatedAt;

    private String reviewedBy;

    // Protected no-arg constructor for JPA
    protected Claim() {}

    // Private constructor — only Builder can create a Claim
    private Claim(Builder builder) {
        this.policyId             = builder.policyId;
        this.amount               = builder.amount;
        this.type                 = builder.type;
        this.policyHolder         = builder.policyHolder;
        this.status               = ClaimStatus.SUBMITTED;  // always starts SUBMITTED
        this.description          = builder.description;
        this.supportingDocumentUrl = builder.supportingDocumentUrl;
        this.submittedAt          = LocalDateTime.now();
        this.lastUpdatedAt        = this.submittedAt;
    }

    // ── STATE TRANSITIONS ──────────────────────────────────────────────────
    // Status can only change via these methods — not via a generic setStatus().
    // This ensures transitions are always valid and lastUpdatedAt is always set.

    public void startReview(String reviewerName) {
        transitionTo(ClaimStatus.UNDER_REVIEW);
        this.reviewedBy = reviewerName;
    }

    public void approve() {
        transitionTo(ClaimStatus.APPROVED);
    }

    public void reject() {
        transitionTo(ClaimStatus.REJECTED);
    }

    public void markPaid() {
        transitionTo(ClaimStatus.PAID);
    }

    /**
     * DRY: all transition logic in ONE method.
     * ClaimStatus.canTransitionTo() contains the rules — not duplicated here.
     */
    private void transitionTo(ClaimStatus newStatus) {
        if (!this.status.canTransitionTo(newStatus)) {
            throw new InvalidClaimTransitionException(
                String.format("Cannot transition claim %s from %s to %s",
                    this.id, this.status, newStatus));
        }
        this.status        = newStatus;
        this.lastUpdatedAt = LocalDateTime.now();
    }

    // ── BUILDER ───────────────────────────────────────────────────────────

    public static Builder builder(String policyId, BigDecimal amount,
                                  ClaimType type, PolicyHolder policyHolder) {
        return new Builder(policyId, amount, type, policyHolder);
    }

    public static final class Builder {

        // Mandatory — in constructor, cannot forget them
        private final String        policyId;
        private final BigDecimal    amount;
        private final ClaimType     type;
        private final PolicyHolder  policyHolder;

        // Optional — with defaults
        private String description;
        private String supportingDocumentUrl;

        private Builder(String policyId, BigDecimal amount,
                        ClaimType type, PolicyHolder policyHolder) {
            // Validate mandatory fields immediately — fail fast
            if (policyId == null || policyId.isBlank())
                throw new IllegalArgumentException("policyId is required");
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0)
                throw new IllegalArgumentException("amount must be positive");
            if (type == null)
                throw new IllegalArgumentException("claim type is required");
            if (policyHolder == null)
                throw new IllegalArgumentException("policyHolder is required");

            this.policyId      = policyId;
            this.amount        = amount;
            this.type          = type;
            this.policyHolder  = policyHolder;
        }

        public Builder description(String description) {
            this.description = description;
            return this; // fluent — enables method chaining
        }

        public Builder supportingDocumentUrl(String url) {
            this.supportingDocumentUrl = url;
            return this;
        }

        /**
         * Final validation before object creation.
         * Object is only created if ALL validation passes — impossible to create an invalid Claim.
         */
        public Claim build() {
            // Cross-field validation
            if (type == ClaimType.HEALTH && (description == null || description.isBlank()))
                throw new IllegalStateException("Health claims require a description");
            return new Claim(this);
        }
    }

    @Override
    public String toString() {
        return "Claim{id=" + id + ", policyId=" + policyId +
               ", type=" + type + ", status=" + status +
               ", amount=" + amount + "}";
    }
}
