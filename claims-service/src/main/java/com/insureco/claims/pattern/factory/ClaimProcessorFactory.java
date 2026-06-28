package com.insureco.claims.pattern.factory;

import com.insureco.claims.domain.Claim;
import com.insureco.claims.domain.ClaimType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;


// ─────────────────────────────────────────────────────────────────────────────
// FACTORY — routes claims to the correct processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FACTORY PATTERN — ClaimProcessorFactory
 *
 * Spring injects ALL ClaimProcessor implementations via the List<ClaimProcessor> constructor.
 * The factory builds a Map<ClaimType, ClaimProcessor> for O(1) lookup.
 *
 * WHY NOT A SWITCH STATEMENT?
 *   switch (type) { case HOME: return new HomeClaimProcessor(); ... }
 *   - Every new claim type requires modifying this class (OCP violation)
 *   - Hard to test individual processors in isolation
 *   - Cannot inject dependencies into processors
 *
 * WITH FACTORY + SPRING:
 *   - New processor = new @Component class, zero changes here
 *   - Each processor is injected with its own dependencies
 *   - Each processor is independently unit-testable
 */
@Slf4j
@Component
public class ClaimProcessorFactory {

    private final Map<ClaimType, ClaimProcessor> processors;

    // Spring injects ALL ClaimProcessor beans — no manual registration
    public ClaimProcessorFactory(List<ClaimProcessor> processorList) {
        this.processors = processorList.stream()
            .collect(Collectors.toMap(
                ClaimProcessor::getSupportedType,
                Function.identity()
            ));
        log.info("ClaimProcessorFactory initialised with processors: {}",
            processors.keySet());
    }

    /**
     * Returns the correct processor for the given claim type.
     * Throws IllegalArgumentException if no processor is registered — fail fast.
     */
    public ClaimProcessor getProcessor(ClaimType type) {
        ClaimProcessor processor = processors.get(type);
        if (processor == null) {
            throw new IllegalArgumentException(
                "No processor registered for claim type: " + type +
                ". Register a @Component implementing ClaimProcessor.");
        }
        return processor;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CONCRETE PROCESSORS — one class per claim type (OCP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Home/Property claim processor.
 * Payout = claimed amount * coverage_ratio (capped at policy limit).
 */
@Slf4j
@Component
class HomeClaimProcessor implements ClaimProcessor {

    private static final BigDecimal COVERAGE_RATIO = new BigDecimal("0.80");
    private static final BigDecimal MAX_PAYOUT     = new BigDecimal("500000");

    @Override
    public BigDecimal calculatePayout(Claim claim) {
        BigDecimal payout = claim.getAmount().multiply(COVERAGE_RATIO);
        // Cap at policy maximum
        payout = payout.min(MAX_PAYOUT);
        log.debug("Home claim {} payout calculated: ${}", claim.getId(), payout);
        return payout;
    }

    @Override
    public List<String> validate(Claim claim) {
        List<String> errors = new java.util.ArrayList<>();
        if (claim.getAmount().compareTo(BigDecimal.ZERO) <= 0)
            errors.add("Claim amount must be positive");
        if (claim.getAmount().compareTo(new BigDecimal("500")) < 0)
            errors.add("Home claims must be at least $500");
        return errors;
    }

    @Override
    public ClaimType getSupportedType() {
        return ClaimType.HOME;
    }
}


/**
 * Health/Medical claim processor.
 * Payout = claimed amount minus excess, subject to annual limit.
 */
@Slf4j
@Component
class HealthClaimProcessor implements ClaimProcessor {

    private static final BigDecimal EXCESS      = new BigDecimal("200");
    private static final BigDecimal ANNUAL_LIMIT = new BigDecimal("100000");

    @Override
    public BigDecimal calculatePayout(Claim claim) {
        // Deduct excess (minimum claim pays nothing if less than excess)
        BigDecimal payout = claim.getAmount().subtract(EXCESS);
        if (payout.compareTo(BigDecimal.ZERO) <= 0) {
            log.debug("Health claim {} below excess — zero payout", claim.getId());
            return BigDecimal.ZERO;
        }
        payout = payout.min(ANNUAL_LIMIT);
        log.debug("Health claim {} payout calculated: ${}", claim.getId(), payout);
        return payout;
    }

    @Override
    public List<String> validate(Claim claim) {
        List<String> errors = new java.util.ArrayList<>();
        if (claim.getAmount().compareTo(BigDecimal.ZERO) <= 0)
            errors.add("Claim amount must be positive");
        // Health claims require a medical reference number (stored in description)
        if (claim.getDescription() == null || claim.getDescription().isBlank())
            errors.add("Health claims require a medical reference in description");
        return errors;
    }

    @Override
    public ClaimType getSupportedType() {
        return ClaimType.HEALTH;
    }
}


/**
 * Vehicle claim processor.
 * Payout = repair cost or market value (whichever is lower) minus excess.
 */
@Slf4j
@Component
class VehicleClaimProcessor implements ClaimProcessor {

    private static final BigDecimal EXCESS          = new BigDecimal("500");
    private static final BigDecimal TOTAL_LOSS_RATIO = new BigDecimal("0.75");

    @Override
    public BigDecimal calculatePayout(Claim claim) {
        BigDecimal payout = claim.getAmount().subtract(EXCESS);
        if (payout.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;

        // If repair cost exceeds 75% of vehicle value — treat as total loss
        // (simplified: just cap at 75% of claimed amount)
        BigDecimal totalLossThreshold = claim.getAmount().multiply(TOTAL_LOSS_RATIO);
        if (payout.compareTo(totalLossThreshold) > 0) {
            log.debug("Vehicle claim {} treated as total loss", claim.getId());
            payout = totalLossThreshold;
        }
        return payout;
    }

    @Override
    public List<String> validate(Claim claim) {
        List<String> errors = new java.util.ArrayList<>();
        if (claim.getAmount().compareTo(BigDecimal.ZERO) <= 0)
            errors.add("Claim amount must be positive");
        if (claim.getAmount().compareTo(new BigDecimal("100")) < 0)
            errors.add("Vehicle claims must exceed the $100 minimum threshold");
        return errors;
    }

    @Override
    public ClaimType getSupportedType() {
        return ClaimType.VEHICLE;
    }
}
