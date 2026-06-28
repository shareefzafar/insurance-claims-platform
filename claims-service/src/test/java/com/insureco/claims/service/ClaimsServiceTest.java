package com.insureco.claims.service;

import com.insureco.claims.domain.*;
import com.insureco.claims.dto.request.CreateClaimRequest;
import com.insureco.claims.dto.response.ClaimResponse;
import com.insureco.claims.exception.ClaimNotFoundException;
import com.insureco.claims.exception.InvalidClaimTransitionException;
import com.insureco.claims.pattern.factory.ClaimProcessor;
import com.insureco.claims.pattern.factory.ClaimProcessorFactory;
import com.insureco.claims.pattern.observer.ClaimEvent;
import com.insureco.claims.pattern.observer.ClaimEventPublisher;
import com.insureco.claims.pattern.strategy.NotificationResult;
import com.insureco.claims.pattern.strategy.NotificationStrategy;
import com.insureco.claims.repository.ClaimRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ClaimsService Unit Tests — JUnit 5 + Mockito
 *
 * F.I.R.S.T. PRINCIPLES:
 *  Fast:           No Spring context, no DB, no network — pure Java
 *  Independent:    Each test creates its own state via @BeforeEach
 *  Repeatable:     No random values, no time dependencies
 *  Self-validating: assertThat + verify — no manual inspection
 *  Thorough:       Happy path + edge cases + error cases
 *
 * WHAT WE MOCK (dependencies — not the system under test):
 *  @Mock ClaimRepository       — no real DB needed
 *  @Mock NotificationStrategy  — no real emails sent
 *  @Mock ClaimEventPublisher   — no real event listeners
 *  @Mock ClaimProcessorFactory — no real processors
 *
 * @InjectMocks ClaimsService   — the REAL class we are testing
 *
 * WHAT WE DO NOT TEST (implementation details):
 *  We test BEHAVIOUR — what does calling approveClaim() DO?
 *  We do NOT test private field values via reflection (brittle).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ClaimsService Unit Tests")
class ClaimsServiceTest {

    // Mocks — Spring dependencies replaced with fakes
    @Mock ClaimRepository       claimRepository;
    @Mock NotificationStrategy  notificationStrategy;
    @Mock ClaimEventPublisher   eventPublisher;
    @Mock ClaimProcessorFactory processorFactory;
    @Mock ClaimProcessor        claimProcessor;

    // The REAL class under test — mocks injected via constructor
    @InjectMocks ClaimsService claimsService;

    // Shared test data
    private PolicyHolder testHolder;
    private Claim        testClaim;

    @BeforeEach
    void setUp() {
        // Create test PolicyHolder
        testHolder = new PolicyHolder(
            "Mohammad Zafar",
            "zafar@insureco.com",
            "+61400000000",
            "S1234567D",
            LocalDate.of(1985, 1, 1)
        );

        // Create test Claim using Builder pattern
        testClaim = Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, testHolder)
            .description("Water damage to roof")
            .build();
    }

    // ── SUBMIT CLAIM TESTS ────────────────────────────────────────────────

    @Nested
    @DisplayName("submitClaim()")
    class SubmitClaimTests {

        @Test
        @DisplayName("Successfully submits a valid claim")
        void shouldSubmitValidClaim() {
            // ARRANGE
            CreateClaimRequest request = new CreateClaimRequest();
            request.setPolicyId("POL-001");
            request.setAmount(BigDecimal.valueOf(500));
            request.setType(ClaimType.HOME);
            request.setDescription("Water damage");

            when(processorFactory.getProcessor(ClaimType.HOME)).thenReturn(claimProcessor);
            when(claimProcessor.validate(any())).thenReturn(List.of()); // no validation errors
            when(claimRepository.save(any(Claim.class))).thenReturn(testClaim);

            // ACT
            ClaimResponse response = claimsService.submitClaim(request, testHolder);

            // ASSERT — test behaviour, not implementation
            assertThat(response).isNotNull();
            assertThat(response.policyId()).isEqualTo("POL-001");
            assertThat(response.status()).isEqualTo(ClaimStatus.SUBMITTED);

            // Verify the event was published (Observer pattern fired)
            verify(eventPublisher).publish(any(ClaimEvent.class));

            // Verify claim was saved
            verify(claimRepository).save(any(Claim.class));
        }

        @Test
        @DisplayName("Throws IllegalArgumentException when validation fails")
        void shouldThrowWhenClaimTypeValidationFails() {
            // ARRANGE
            CreateClaimRequest request = new CreateClaimRequest();
            request.setPolicyId("POL-001");
            request.setAmount(BigDecimal.valueOf(50)); // below HOME minimum of $500
            request.setType(ClaimType.HOME);

            when(processorFactory.getProcessor(ClaimType.HOME)).thenReturn(claimProcessor);
            when(claimProcessor.validate(any()))
                .thenReturn(List.of("Home claims must be at least $500"));

            // ACT + ASSERT
            assertThatThrownBy(() -> claimsService.submitClaim(request, testHolder))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Home claims must be at least $500");

            // Verify NO save occurred — fail before persisting
            verify(claimRepository, never()).save(any());
            // Verify NO event published — no side effects on failure
            verify(eventPublisher, never()).publish(any());
        }
    }

    // ── APPROVE CLAIM TESTS ───────────────────────────────────────────────

    @Nested
    @DisplayName("approveClaim()")
    class ApproveClaimTests {

        @Test
        @DisplayName("Successfully approves a claim and sends notification")
        void shouldApproveClaimAndSendNotification() {
            // ARRANGE
            when(claimRepository.findById("CLAIM-001")).thenReturn(Optional.of(testClaim));
            when(processorFactory.getProcessor(ClaimType.HOME)).thenReturn(claimProcessor);
            when(claimProcessor.calculatePayout(any())).thenReturn(BigDecimal.valueOf(400));
            when(claimRepository.save(any())).thenReturn(testClaim);

            NotificationResult successResult = NotificationResult.builder("EMAIL")
                .success("MSG-001").build();
            when(notificationStrategy.notify(any())).thenReturn(successResult);

            // ACT
            ClaimResponse response = claimsService.approveClaim("CLAIM-001", "reviewer@insureco.com");

            // ASSERT
            assertThat(response).isNotNull();

            // Verify Observer pattern — event published
            ArgumentCaptor<ClaimEvent> eventCaptor = ArgumentCaptor.forClass(ClaimEvent.class);
            verify(eventPublisher).publish(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getNewStatus()).isEqualTo("APPROVED");

            // Verify Strategy pattern — notification sent
            verify(notificationStrategy).notify(any(Claim.class));
        }

        @Test
        @DisplayName("Throws ClaimNotFoundException when claim does not exist")
        void shouldThrowWhenClaimNotFound() {
            // ARRANGE
            when(claimRepository.findById("MISSING")).thenReturn(Optional.empty());

            // ACT + ASSERT
            assertThatThrownBy(() -> claimsService.approveClaim("MISSING", "reviewer@insureco.com"))
                .isInstanceOf(ClaimNotFoundException.class)
                .hasMessageContaining("MISSING");

            // No notification sent for non-existent claim
            verify(notificationStrategy, never()).notify(any());
        }

        @Test
        @DisplayName("Approval succeeds even when notification fails — non-fatal")
        void shouldSucceedEvenWhenNotificationFails() {
            // ARRANGE
            when(claimRepository.findById("CLAIM-001")).thenReturn(Optional.of(testClaim));
            when(processorFactory.getProcessor(ClaimType.HOME)).thenReturn(claimProcessor);
            when(claimProcessor.calculatePayout(any())).thenReturn(BigDecimal.valueOf(400));
            when(claimRepository.save(any())).thenReturn(testClaim);

            // Notification fails — but approval should still succeed
            NotificationResult failResult = NotificationResult.builder("EMAIL")
                .failure("SMTP server unreachable").build();
            when(notificationStrategy.notify(any())).thenReturn(failResult);

            // ACT — should NOT throw even though notification failed
            assertThatNoException().isThrownBy(
                () -> claimsService.approveClaim("CLAIM-001", "reviewer@insureco.com")
            );

            // Claim was still saved despite notification failure
            verify(claimRepository).save(any());
        }
    }

    // ── REJECT CLAIM TESTS ────────────────────────────────────────────────

    @Nested
    @DisplayName("rejectClaim()")
    class RejectClaimTests {

        @Test
        @DisplayName("Successfully rejects a submitted claim")
        void shouldRejectSubmittedClaim() {
            // ARRANGE
            when(claimRepository.findById("CLAIM-001")).thenReturn(Optional.of(testClaim));
            when(claimRepository.save(any())).thenReturn(testClaim);

            // ACT
            claimsService.rejectClaim("CLAIM-001", "reviewer@insureco.com");

            // ASSERT — event published with REJECTED status
            ArgumentCaptor<ClaimEvent> captor = ArgumentCaptor.forClass(ClaimEvent.class);
            verify(eventPublisher).publish(captor.capture());
            assertThat(captor.getValue().getNewStatus()).isEqualTo("REJECTED");

            // No notification sent for rejected claims (only approvals)
            verify(notificationStrategy, never()).notify(any());
        }
    }

    // ── QUERY TESTS ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("getClaim()")
    class GetClaimTests {

        @Test
        @DisplayName("Returns claim when found")
        void shouldReturnClaimWhenFound() {
            when(claimRepository.findById("CLAIM-001")).thenReturn(Optional.of(testClaim));

            ClaimResponse response = claimsService.getClaim("CLAIM-001");

            assertThat(response).isNotNull();
            assertThat(response.policyId()).isEqualTo("POL-001");
        }

        @Test
        @DisplayName("Throws ClaimNotFoundException when not found")
        void shouldThrowClaimNotFoundException() {
            when(claimRepository.findById("MISSING")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> claimsService.getClaim("MISSING"))
                .isInstanceOf(ClaimNotFoundException.class);
        }
    }
}
