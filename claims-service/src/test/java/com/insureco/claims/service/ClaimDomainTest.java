package com.insureco.claims.service;

import com.insureco.claims.domain.*;
import com.insureco.claims.exception.InvalidClaimTransitionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.*;

/**
 * Claim Domain Tests — Builder Pattern + State Machine
 *
 * Tests:
 *  1. Builder pattern — mandatory field validation, optional fields, immutability
 *  2. State transitions — valid and invalid transitions
 *  3. Domain invariants — claims start as SUBMITTED, timestamps set
 */
@DisplayName("Claim Domain — Builder Pattern & State Transitions")
class ClaimDomainTest {

    private PolicyHolder holder;

    @BeforeEach
    void setUp() {
        holder = new PolicyHolder("Mohammad Zafar", "zafar@insureco.com",
            "+61400000000", "S1234567D", LocalDate.of(1985, 1, 1));
    }

    // ── BUILDER TESTS ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Builder creates a valid Claim with all mandatory fields")
    void shouldBuildValidClaim() {
        Claim claim = Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, holder)
            .description("Water damage")
            .build();

        assertThat(claim.getPolicyId()).isEqualTo("POL-001");
        assertThat(claim.getAmount()).isEqualByComparingTo("500");
        assertThat(claim.getType()).isEqualTo(ClaimType.HOME);
        assertThat(claim.getStatus()).isEqualTo(ClaimStatus.SUBMITTED); // always starts SUBMITTED
        assertThat(claim.getSubmittedAt()).isNotNull();
        assertThat(claim.getPolicyHolder()).isEqualTo(holder);
    }

    @Test
    @DisplayName("Builder throws when policyId is blank — fail fast")
    void shouldRejectBlankPolicyId() {
        assertThatThrownBy(() ->
            Claim.builder("", BigDecimal.valueOf(500), ClaimType.HOME, holder).build()
        )
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("policyId is required");
    }

    @Test
    @DisplayName("Builder throws when amount is negative")
    void shouldRejectNegativeAmount() {
        assertThatThrownBy(() ->
            Claim.builder("POL-001", BigDecimal.valueOf(-100), ClaimType.HOME, holder).build()
        )
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("amount must be positive");
    }

    @Test
    @DisplayName("Builder throws when policyHolder is null")
    void shouldRejectNullHolder() {
        assertThatThrownBy(() ->
            Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, null).build()
        )
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("policyHolder is required");
    }

    @Test
    @DisplayName("Health claim Builder throws when description is missing")
    void shouldRejectHealthClaimWithoutDescription() {
        assertThatThrownBy(() ->
            Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HEALTH, holder)
                // No description — required for HEALTH claims
                .build()
        )
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Health claims require a description");
    }

    @Test
    @DisplayName("Health claim with description builds successfully")
    void shouldBuildHealthClaimWithDescription() {
        assertThatNoException().isThrownBy(() ->
            Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HEALTH, holder)
                .description("Hospital visit — Invoice #12345")
                .build()
        );
    }

    // ── STATE TRANSITION TESTS ─────────────────────────────────────────────

    @Test
    @DisplayName("SUBMITTED -> UNDER_REVIEW is a valid transition")
    void shouldAllowSubmittedToUnderReview() {
        Claim claim = buildHomeClaim();

        assertThatNoException().isThrownBy(() -> claim.startReview("reviewer@insureco.com"));
        assertThat(claim.getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(claim.getReviewedBy()).isEqualTo("reviewer@insureco.com");
    }

    @Test
    @DisplayName("UNDER_REVIEW -> APPROVED is a valid transition")
    void shouldAllowUnderReviewToApproved() {
        Claim claim = buildHomeClaim();
        claim.startReview("reviewer@insureco.com");

        assertThatNoException().isThrownBy(claim::approve);
        assertThat(claim.getStatus()).isEqualTo(ClaimStatus.APPROVED);
    }

    @Test
    @DisplayName("APPROVED -> PAID is a valid transition")
    void shouldAllowApprovedToPaid() {
        Claim claim = buildHomeClaim();
        claim.startReview("reviewer@insureco.com");
        claim.approve();

        assertThatNoException().isThrownBy(claim::markPaid);
        assertThat(claim.getStatus()).isEqualTo(ClaimStatus.PAID);
    }

    @Test
    @DisplayName("SUBMITTED -> APPROVED is INVALID — must go through UNDER_REVIEW")
    void shouldRejectDirectSubmittedToApproved() {
        Claim claim = buildHomeClaim();
        // Cannot skip UNDER_REVIEW
        assertThatThrownBy(claim::approve)
            .isInstanceOf(InvalidClaimTransitionException.class)
            .hasMessageContaining("SUBMITTED")
            .hasMessageContaining("APPROVED");
    }

    @Test
    @DisplayName("REJECTED claim cannot transition to any state — terminal")
    void shouldRejectTransitionFromRejected() {
        Claim claim = buildHomeClaim();
        claim.startReview("reviewer@insureco.com");
        claim.reject();

        // REJECTED is terminal — no further transitions allowed
        assertThatThrownBy(claim::approve)
            .isInstanceOf(InvalidClaimTransitionException.class);
        assertThatThrownBy(claim::markPaid)
            .isInstanceOf(InvalidClaimTransitionException.class);
    }

    @Test
    @DisplayName("PAID claim cannot transition — terminal state")
    void shouldRejectTransitionFromPaid() {
        Claim claim = buildHomeClaim();
        claim.startReview("reviewer@insureco.com");
        claim.approve();
        claim.markPaid();

        assertThatThrownBy(claim::approve)
            .isInstanceOf(InvalidClaimTransitionException.class);
    }

    @Test
    @DisplayName("lastUpdatedAt is updated on every transition")
    void shouldUpdateTimestampOnTransition() throws InterruptedException {
        Claim claim = buildHomeClaim();
        var submittedAt = claim.getLastUpdatedAt();

        Thread.sleep(10); // ensure timestamp difference
        claim.startReview("reviewer@insureco.com");

        assertThat(claim.getLastUpdatedAt()).isAfter(submittedAt);
    }

    // ── HELPER ────────────────────────────────────────────────────────────

    private Claim buildHomeClaim() {
        return Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, holder)
            .description("Water damage")
            .build();
    }
}
