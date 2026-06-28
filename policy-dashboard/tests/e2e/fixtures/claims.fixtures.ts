/**
 * Test Data Factories
 * ====================
 * Typed test data factories using Builder-like pattern in TypeScript.
 * Partial<T> allows overriding only the fields needed per test — DRY.
 */

import type { ClaimSummary, ClaimStatus, ClaimType } from '@/types/policy.types';

let claimCounter = 0;

export function createClaim(overrides: Partial<ClaimSummary> = {}): ClaimSummary {
  claimCounter++;
  return {
    id:          `claim-${String(claimCounter).padStart(3, '0')}`,
    policyId:    `POL-${String(claimCounter).padStart(3, '0')}`,
    type:        'HOME',
    status:      'SUBMITTED',
    amount:      500.00,
    submittedAt: new Date().toISOString(),
    ...overrides,  // caller can override any field
  };
}

export function createClaims(
  count: number,
  overrides: Partial<ClaimSummary> = {}
): ClaimSummary[] {
  return Array.from({ length: count }, () => createClaim(overrides));
}

export function createClaimsByStatus(
  counts: Partial<Record<ClaimStatus, number>>
): ClaimSummary[] {
  return (Object.entries(counts) as [ClaimStatus, number][])
    .flatMap(([status, count]) =>
      Array.from({ length: count }, () => createClaim({ status }))
    );
}

// Pre-built fixtures for common test scenarios
export const FIXTURES = {
  singleSubmittedClaim:   [createClaim({ status: 'SUBMITTED' })],
  singleUnderReviewClaim: [createClaim({ status: 'UNDER_REVIEW', id: 'under-review-001' })],
  singleApprovedClaim:    [createClaim({ status: 'APPROVED' })],
  tenMixedClaims:         createClaimsByStatus({ SUBMITTED: 4, UNDER_REVIEW: 3, APPROVED: 2, REJECTED: 1 }),
  emptyClaims:            [] as ClaimSummary[],
};
