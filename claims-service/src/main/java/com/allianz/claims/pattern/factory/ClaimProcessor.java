package com.allianz.claims.pattern.factory;

import com.allianz.claims.domain.Claim;
import com.allianz.claims.domain.ClaimType;

import java.math.BigDecimal;
import java.util.List;

/**
 * FACTORY PATTERN — ClaimProcessor
 *
 * OCP: Adding a new claim type (e.g. TRAVEL) requires:
 *  1. Add TRAVEL to ClaimType enum
 *  2. Create TravelClaimProcessor implementing ClaimProcessor
 *  3. Annotate with @Component
 *  ZERO changes to ClaimProcessorFactory or any existing code.
 *
 * DIP: ClaimsService depends on this interface + ClaimProcessorFactory.
 *      It never imports HomeClaimProcessor or HealthClaimProcessor directly.
 */
public interface ClaimProcessor {

    /**
     * Calculate the approved payout amount for this claim.
     * Each claim type has different calculation rules.
     */
    BigDecimal calculatePayout(Claim claim);

    /**
     * Validate claim-type-specific rules.
     * Returns a list of validation errors (empty = valid).
     */
    List<String> validate(Claim claim);

    /**
     * Returns the ClaimType this processor handles.
     * Used by the factory to route claims to the correct processor.
     */
    ClaimType getSupportedType();
}

