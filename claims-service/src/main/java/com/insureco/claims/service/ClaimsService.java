package com.insureco.claims.service;

import com.insureco.claims.domain.Claim;
import com.insureco.claims.domain.ClaimStatus;
import com.insureco.claims.domain.ClaimType;
import com.insureco.claims.domain.PolicyHolder;
import com.insureco.claims.dto.request.CreateClaimRequest;
import com.insureco.claims.dto.response.ClaimResponse;
import com.insureco.claims.exception.ClaimNotFoundException;
import com.insureco.claims.pattern.factory.ClaimProcessor;
import com.insureco.claims.pattern.factory.ClaimProcessorFactory;
import com.insureco.claims.pattern.observer.ClaimEvent;
import com.insureco.claims.pattern.observer.ClaimEventPublisher;
import com.insureco.claims.pattern.singleton.ConfigurationManager;
import com.insureco.claims.pattern.strategy.NotificationResult;
import com.insureco.claims.pattern.strategy.NotificationStrategy;
import com.insureco.claims.repository.ClaimRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * ClaimsService — Business Logic Layer
 *
 * SOLID PRINCIPLES DEMONSTRATED:
 *
 *  SRP: This class handles ONLY business orchestration.
 *       Notification → NotificationStrategy (injected)
 *       Payout calculation → ClaimProcessor (from factory)
 *       Event publishing → ClaimEventPublisher (injected)
 *       Persistence → ClaimRepository (injected)
 *
 *  OCP: Adding a new claim type (e.g. TRAVEL)?
 *       Create TravelClaimProcessor @Component. Zero changes here.
 *
 *  LSP: NotificationStrategy contract: notify() WILL deliver.
 *       Any strategy substituted here honours that contract.
 *
 *  ISP: This class depends only on focused interfaces — not fat ones.
 *       ClaimRepository: data access only.
 *       NotificationStrategy: notification only.
 *
 *  DIP: Every dependency is an interface injected via constructor.
 *       No new EmailNotificationStrategy() anywhere.
 *
 * DESIGN PATTERNS USED:
 *  - Singleton: ConfigurationManager.getInstance() for config values
 *  - Strategy:  NotificationStrategy for notification channel
 *  - Observer:  ClaimEventPublisher for event-driven side effects
 *  - Factory:   ClaimProcessorFactory for claim-type-specific processing
 *  - Builder:   Claim.builder() for constructing domain objects
 */
@Slf4j
@Service
@Transactional
public class ClaimsService {

    // All dependencies are INTERFACES — DIP applied
    private final ClaimRepository      claimRepository;
    private final NotificationStrategy notificationStrategy; // Strategy pattern
    private final ClaimEventPublisher  eventPublisher;       // Observer pattern
    private final ClaimProcessorFactory processorFactory;    // Factory pattern

    // Constructor injection — all mandatory dependencies declared here
    // Spring resolves each interface to the correct @Component at runtime
    public ClaimsService(ClaimRepository claimRepository,
                         NotificationStrategy notificationStrategy,
                         ClaimEventPublisher eventPublisher,
                         ClaimProcessorFactory processorFactory) {
        this.claimRepository      = claimRepository;
        this.notificationStrategy = notificationStrategy;
        this.eventPublisher       = eventPublisher;
        this.processorFactory     = processorFactory;
    }

    // ── SUBMIT CLAIM ──────────────────────────────────────────────────────

    /**
     * Submit a new claim.
     *
     * BUILDER PATTERN: Claim.builder() ensures all mandatory fields are provided
     * and validation passes before the object is created.
     *
     * FACTORY PATTERN: Get the correct processor for this claim type and
     * validate claim-type-specific rules.
     */
    public ClaimResponse submitClaim(CreateClaimRequest request, PolicyHolder holder) {
        log.info("Submitting {} claim for policy {} amount ${}",
            request.getType(), request.getPolicyId(), request.getAmount());

        // BUILDER PATTERN — mandatory fields in constructor, validation in build()
        Claim claim = Claim.builder(
                request.getPolicyId(),
                request.getAmount(),
                request.getType(),
                holder)
            .description(request.getDescription())
            .supportingDocumentUrl(request.getSupportingDocumentUrl())
            .build();

        // FACTORY PATTERN — get correct processor for this claim type
        ClaimProcessor processor = processorFactory.getProcessor(claim.getType());

        // Validate claim-type-specific rules
        List<String> validationErrors = processor.validate(claim);
        if (!validationErrors.isEmpty()) {
            throw new IllegalArgumentException(
                "Claim validation failed: " + String.join(", ", validationErrors));
        }

        Claim saved = claimRepository.save(claim);

        // OBSERVER PATTERN — publish event, all registered listeners notified
        eventPublisher.publish(new ClaimEvent(saved, null));

        log.info("Claim {} submitted successfully", saved.getId());
        return ClaimResponse.from(saved);
    }

    // ── APPROVE CLAIM ─────────────────────────────────────────────────────

    /**
     * Approve a claim.
     *
     * SINGLETON PATTERN: Read max claim amount from ConfigurationManager.
     * FACTORY PATTERN: Calculate payout using the correct ClaimProcessor.
     * OBSERVER PATTERN: Publish event — listeners handle notifications, audit.
     * STRATEGY PATTERN: Send notification via injected NotificationStrategy.
     */
    public ClaimResponse approveClaim(String claimId, String approvedBy) {
        log.info("Approving claim {} by {}", claimId, approvedBy);

        Claim claim = findClaimById(claimId);
        String oldStatus = claim.getStatus().name();

        // SINGLETON — read config from the single ConfigurationManager instance
        ConfigurationManager config = ConfigurationManager.getInstance();
        BigDecimal maxAmount = new BigDecimal(config.get("claims.max.amount", "1000000"));

        if (claim.getAmount().compareTo(maxAmount) > 0) {
            throw new IllegalStateException(
                "Claim amount exceeds maximum allowed: " + maxAmount);
        }

        // FACTORY — calculate payout using claim-type-specific processor
        ClaimProcessor processor = processorFactory.getProcessor(claim.getType());
        BigDecimal payout = processor.calculatePayout(claim);
        log.info("Claim {} payout calculated: ${}", claimId, payout);

        // State transition — domain method handles validation
        claim.startReview(approvedBy);
        claim.approve();

        Claim saved = claimRepository.save(claim);

        // OBSERVER — publish event (AuditLogListener, ApprovalNotificationListener fire)
        eventPublisher.publish(new ClaimEvent(saved, oldStatus));

        // STRATEGY — send notification via injected channel (Email/SMS/SNS)
        NotificationResult notificationResult = notificationStrategy.notify(saved);
        if (!notificationResult.isSuccess()) {
            log.warn("Notification failed for claim {}: {}",
                claimId, notificationResult.getErrorMessage());
            // Non-fatal — claim approval succeeds even if notification fails
        }

        return ClaimResponse.from(saved);
    }

    // ── REJECT CLAIM ──────────────────────────────────────────────────────

    public ClaimResponse rejectClaim(String claimId, String reviewedBy) {
        log.info("Rejecting claim {} by {}", claimId, reviewedBy);

        Claim claim = findClaimById(claimId);
        String oldStatus = claim.getStatus().name();

        claim.startReview(reviewedBy);
        claim.reject();

        Claim saved = claimRepository.save(claim);

        // OBSERVER — RejectionListener handles rejection-specific side effects
        eventPublisher.publish(new ClaimEvent(saved, oldStatus));

        return ClaimResponse.from(saved);
    }

    // ── QUERIES ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ClaimResponse getClaim(String claimId) {
        return ClaimResponse.from(findClaimById(claimId));
    }

    @Transactional(readOnly = true)
    public Page<ClaimResponse> getClaimsByStatus(ClaimStatus status, Pageable pageable) {
        return claimRepository.findByStatus(status, pageable)
            .map(ClaimResponse::from);
    }

    @Transactional(readOnly = true)
    public List<ClaimResponse> getClaimsByPolicy(String policyId) {
        return claimRepository.findByPolicyId(policyId)
            .stream()
            .map(ClaimResponse::from)
            .toList();
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────

    /**
     * DRY: findClaimById used in multiple methods — one place to maintain.
     */
    private Claim findClaimById(String claimId) {
        return claimRepository.findById(claimId)
            .orElseThrow(() -> new ClaimNotFoundException(claimId));
    }
}
