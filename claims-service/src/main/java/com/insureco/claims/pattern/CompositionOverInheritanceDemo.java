package com.insureco.claims.pattern;

import com.insureco.claims.domain.Claim;
import com.insureco.claims.domain.ClaimType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * COMPOSITION OVER INHERITANCE — Explicit Demonstration
 * ======================================================
 *
 * This file exists to make the design choice VISIBLE and DISCUSSABLE in an interview.
 * The real application uses composition (see ClaimProcessorFactory).
 * This file shows the WRONG approach (inheritance) side-by-side with the RIGHT approach.
 *
 * INTERVIEW QUESTION:
 * "Where did you choose composition over inheritance in this project?"
 *
 * ANSWER: "Two places specifically:
 *
 *  1. ClaimsService HAS-A NotificationStrategy (interface).
 *     The bad alternative was BaseNotificationService → EmailNotificationService → SmsNotificationService.
 *     With inheritance: changing the base class breaks all subclasses (fragile base class problem).
 *     With composition: each strategy is independent, swappable at runtime, testable in isolation.
 *
 *  2. ClaimProcessorFactory routes claims to a ClaimProcessor (interface).
 *     The bad alternative was BaseClaimProcessor → HomeClaimProcessor → VehicleClaimProcessor.
 *     With inheritance: adding TRAVEL claim type means modifying the hierarchy.
 *     With composition: new @Component class only — existing processors untouched."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * APPROACH 1 — WRONG: Inheritance (do NOT use this)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Problem: FRAGILE BASE CLASS
 *
 * BaseClaimProcessor defines process() which all subclasses call via super.process().
 * If BaseClaimProcessor changes (e.g. adds a new timeout), ALL subclasses are affected
 * whether they want the change or not — even if they override process().
 *
 * The call chain: HomeClaimProcessor.process() → super → BaseClaimProcessor.process()
 * is invisible and fragile. A change to the parent silently breaks children.
 *
 * Cannot swap processing strategies at runtime — the class hierarchy is fixed at compile time.
 * Cannot independently unit-test HomeClaimProcessor without instantiating BaseClaimProcessor.
 */

// ─── WRONG APPROACH (inheritance) — commented out deliberately ───────────────
//
// abstract class BaseClaimProcessor {
//     // FRAGILE: every subclass MUST call super.process() to get base validation
//     // If we add new behaviour here, ALL subclasses are affected
//     BigDecimal process(Claim claim) {
//         validateCommon(claim);              // common validation
//         return calculatePayout(claim);      // abstract — subclass implements
//     }
//     private void validateCommon(Claim claim) { /* ... */ }
//     protected abstract BigDecimal calculatePayout(Claim claim);
// }
//
// class HomeClaimProcessor extends BaseClaimProcessor {
//     @Override protected BigDecimal calculatePayout(Claim claim) {
//         return claim.getAmount().multiply(new BigDecimal("0.80"));
//         // PROBLEM: HomeClaimProcessor is tightly coupled to BaseClaimProcessor.
//         // Adding TRAVEL requires creating TravelClaimProcessor extends BaseClaimProcessor.
//         // If BaseClaimProcessor.validateCommon() changes — all subclasses may break.
//     }
// }
//
// class VehicleClaimProcessor extends BaseClaimProcessor {
//     @Override protected BigDecimal calculatePayout(Claim claim) {
//         return claim.getAmount().subtract(new BigDecimal("500")); // excess deducted
//         // PROBLEM: what if Vehicle needs DIFFERENT base validation than Home?
//         // Cannot opt out — forced to take whatever the base class does.
//     }
// }
//
// class ClaimsService {
//     // PROBLEM: which processor? Must use if/switch — OCP violated
//     BigDecimal process(Claim claim) {
//         if (claim.getType() == ClaimType.HOME) {
//             return new HomeClaimProcessor().calculatePayout(claim); // direct coupling
//         } else if (claim.getType() == ClaimType.VEHICLE) {
//             return new VehicleClaimProcessor().calculatePayout(claim);
//         }
//         // Adding TRAVEL: ADD another else if HERE — modifying existing code (OCP violation)
//         throw new IllegalArgumentException("Unknown claim type");
//     }
// }


// ─── RIGHT APPROACH (composition) — what the project actually uses ────────────

/**
 * APPROACH 2 — CORRECT: Composition via interface
 *
 * ClaimsService HAS-A ClaimProcessor (injected — DIP).
 * Each processor is independent — no inheritance, no super() calls, no coupling.
 * Adding TRAVEL: new TravelClaimProcessor @Component. Nothing else changes.
 *
 * This is what ClaimProcessorFactory already implements in the real code.
 * Shown here as a compact reference for the interview.
 */

interface ClaimPayoutCalculator {
    BigDecimal calculate(Claim claim);
    ClaimType supports();
}

@Slf4j
@Component
class HomePayoutCalculator implements ClaimPayoutCalculator {

    private static final BigDecimal COVERAGE_RATIO = new BigDecimal("0.80");

    @Override
    public BigDecimal calculate(Claim claim) {
        // Completely independent — no super() call, no base class risk
        BigDecimal payout = claim.getAmount().multiply(COVERAGE_RATIO);
        log.debug("Home payout for {}: ${}", claim.getId(), payout);
        return payout;
    }

    @Override
    public ClaimType supports() {
        return ClaimType.HOME;
    }
}

@Slf4j
@Component
class VehiclePayoutCalculator implements ClaimPayoutCalculator {

    private static final BigDecimal EXCESS = new BigDecimal("500");

    @Override
    public BigDecimal calculate(Claim claim) {
        // Completely independent — can apply its own rules without touching HomePayoutCalculator
        BigDecimal payout = claim.getAmount().subtract(EXCESS).max(BigDecimal.ZERO);
        log.debug("Vehicle payout for {}: ${}", claim.getId(), payout);
        return payout;
    }

    @Override
    public ClaimType supports() {
        return ClaimType.VEHICLE;
    }
}

// Adding TRAVEL: ONE new class below. HomePayoutCalculator and VehiclePayoutCalculator
// are completely untouched. ClaimsService is untouched. This is OCP + Composition.

// @Slf4j
// @Component
// class TravelPayoutCalculator implements ClaimPayoutCalculator {
//     @Override public BigDecimal calculate(Claim claim) { ... }
//     @Override public ClaimType supports() { return ClaimType.TRAVEL; }
// }


/**
 * SUMMARY — Why Composition wins here:
 *
 * ┌─────────────────────┬──────────────────────────┬─────────────────────────────┐
 * │                     │  Inheritance              │  Composition (this project) │
 * ├─────────────────────┼──────────────────────────┼─────────────────────────────┤
 * │ Adding TRAVEL type  │ New subclass + modify     │ New @Component only         │
 * │                     │ base class or factory     │ Zero other changes (OCP)    │
 * ├─────────────────────┼──────────────────────────┼─────────────────────────────┤
 * │ Testing in isolation│ Must instantiate parent   │ Direct instantiation        │
 * │                     │ hierarchy too             │ No parent dependency        │
 * ├─────────────────────┼──────────────────────────┼─────────────────────────────┤
 * │ Base class changes  │ Silently breaks all       │ No impact — no base class   │
 * │                     │ subclasses (fragile)      │ (fragile base class = gone) │
 * ├─────────────────────┼──────────────────────────┼─────────────────────────────┤
 * │ Runtime swapping    │ Not possible — hierarchy  │ Swap via Spring @Primary    │
 * │                     │ fixed at compile time     │ or @ConditionalOnProperty   │
 * └─────────────────────┴──────────────────────────┴─────────────────────────────┘
 */
