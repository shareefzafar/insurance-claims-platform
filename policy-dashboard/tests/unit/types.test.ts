/**
 * TypeScript Type System — Runtime Tests
 * ========================================
 * Tests: discriminated union exhaustiveness, getClaimEventSummary,
 *        type narrowing correctness at runtime.
 *
 * TypeScript types are erased at runtime — these tests verify the
 * RUNTIME BEHAVIOUR that the type system was designed to protect.
 */

import { getClaimEventSummary } from '@/types/policy.types';
import type { ClaimEvent } from '@/types/policy.types';

describe('getClaimEventSummary() — discriminated union exhaustiveness', () => {

  test('SUBMITTED: shows claim ID and amount', () => {
    const event: ClaimEvent = {
      type:        'SUBMITTED',
      claimId:     'CLAIM-001',
      amount:      500.00,
      submittedAt: '2024-01-15T10:00:00Z',
    };
    const summary = getClaimEventSummary(event);
    expect(summary).toContain('CLAIM-001');
    expect(summary).toContain('500.00');
  });

  test('UNDER_REVIEW: shows reviewer name', () => {
    const event: ClaimEvent = {
      type:       'UNDER_REVIEW',
      claimId:    'CLAIM-001',
      reviewedBy: 'reviewer@insureco.com',
      startedAt:  '2024-01-15T11:00:00Z',
    };
    const summary = getClaimEventSummary(event);
    expect(summary).toContain('CLAIM-001');
    expect(summary).toContain('reviewer@insureco.com');
    // TypeScript knows: event.amount does NOT exist in this branch
    // If we tried event.amount in the UNDER_REVIEW case — compile error
  });

  test('APPROVED: shows approver and payout amount', () => {
    const event: ClaimEvent = {
      type:       'APPROVED',
      claimId:    'CLAIM-001',
      approvedBy: 'manager@insureco.com',
      payout:     400.00,
      approvedAt: '2024-01-16T09:00:00Z',
    };
    const summary = getClaimEventSummary(event);
    expect(summary).toContain('CLAIM-001');
    expect(summary).toContain('400.00');
    expect(summary).toContain('manager@insureco.com');
  });

  test('REJECTED: shows rejector and reason', () => {
    const event: ClaimEvent = {
      type:       'REJECTED',
      claimId:    'CLAIM-001',
      rejectedBy: 'reviewer@insureco.com',
      reason:     'Insufficient documentation',
      rejectedAt: '2024-01-16T10:00:00Z',
    };
    const summary = getClaimEventSummary(event);
    expect(summary).toContain('CLAIM-001');
    expect(summary).toContain('Insufficient documentation');
  });

  test('PAID: shows transaction ID', () => {
    const event: ClaimEvent = {
      type:          'PAID',
      claimId:       'CLAIM-001',
      paidAt:        '2024-01-20T15:00:00Z',
      transactionId: 'TXN-999888',
    };
    const summary = getClaimEventSummary(event);
    expect(summary).toContain('CLAIM-001');
    expect(summary).toContain('TXN-999888');
  });

  test('all event types produce a non-empty string', () => {
    const events: ClaimEvent[] = [
      { type: 'SUBMITTED',    claimId: 'C1', amount: 100, submittedAt: '' },
      { type: 'UNDER_REVIEW', claimId: 'C1', reviewedBy: 'r@a.com', startedAt: '' },
      { type: 'APPROVED',     claimId: 'C1', approvedBy: 'r@a.com', payout: 90, approvedAt: '' },
      { type: 'REJECTED',     claimId: 'C1', rejectedBy: 'r@a.com', reason: 'no', rejectedAt: '' },
      { type: 'PAID',         claimId: 'C1', paidAt: '', transactionId: 'T1' },
    ];

    events.forEach(event => {
      const summary = getClaimEventSummary(event);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain('C1'); // claimId in every summary
    });
  });
});
