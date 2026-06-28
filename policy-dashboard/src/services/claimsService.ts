/**
 * Claims Service — typed domain service layer
 * ============================================
 * Demonstrates: TypeScript generics, async/await patterns,
 *               parallel fetching, discriminated union handling.
 */

import { apiClient } from './apiClient';
import { fetchParallel, safeAsync } from '@/utils/promiseUtils';
import { dashboardEvents } from '@/utils/eventEmitter';
import type {
  Claim,
  ClaimSummary,
  ClaimStatus,
  ClaimType,
  ClaimFilters,
  CreateClaimRequest,
  Page,
  SortState,
  PaginationState,
} from '@/types/policy.types';

// ─────────────────────────────────────────────────────────────────────────────
// CLAIMS SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const claimsService = {

  /**
   * Fetch claims with filters, sort, and pagination.
   * TypeScript knows: returns Promise<Page<ClaimSummary>>, not Promise<unknown>.
   */
  async getClaims(
    filters: ClaimFilters = {},
    sort: SortState = { field: 'submittedAt', order: 'desc' },
    pagination: PaginationState = { page: 0, size: 20 }
  ): Promise<Page<ClaimSummary>> {
    const params = new URLSearchParams();

    // Only add params that are defined — no ?status=undefined in the URL
    if (filters.status)    params.set('status',    filters.status);
    if (filters.type)      params.set('type',      filters.type);
    if (filters.policyId)  params.set('policyId',  filters.policyId);
    if (filters.dateFrom)  params.set('dateFrom',  filters.dateFrom);
    if (filters.dateTo)    params.set('dateTo',    filters.dateTo);
    if (filters.minAmount !== undefined) params.set('minAmount', String(filters.minAmount));
    if (filters.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount));

    params.set('sort',  `${sort.field},${sort.order}`);
    params.set('page',  String(pagination.page));
    params.set('size',  String(pagination.size));

    return apiClient.get<Page<ClaimSummary>>(`/claims?${params.toString()}`);
  },

  /**
   * Fetch a single claim by ID.
   */
  async getClaim(claimId: string): Promise<Claim> {
    return apiClient.get<Claim>(`/claims/${claimId}`);
  },

  /**
   * Fetch policy AND its claims simultaneously.
   *
   * Sequential (WRONG): await fetchPolicy() then await fetchClaims() = 500ms+
   * Parallel (RIGHT):   both start at once = max(300ms, 200ms) = 300ms
   *
   * TypeScript infers: [Policy, Page<ClaimSummary>] from the tuple.
   */
  async getClaimsByPolicy(policyId: string): Promise<Page<ClaimSummary>> {
    return apiClient.get<Page<ClaimSummary>>(`/claims/policy/${policyId}`);
  },

  /**
   * Submit a new claim. Emits event on success for the Observer pattern.
   */
  async submitClaim(request: CreateClaimRequest): Promise<Claim> {
    const claim = await apiClient.post<Claim>('/claims', request);

    // OBSERVER PATTERN: emit event — listeners react independently
    dashboardEvents.emit('claim:submitted', claim.id, claim.amount);

    return claim;
  },

  /**
   * Approve a claim. Uses safeAsync — caller checks result.success, no try/catch needed.
   */
  async approveClaim(
    claimId: string
  ): Promise<{ success: true; data: Claim } | { success: false; error: string }> {
    const result = await safeAsync(() =>
      apiClient.put<Claim>(`/claims/${claimId}/approve`, {})
    );

    if (result.success) {
      dashboardEvents.emit('claim:approved', claimId, result.data.amount);
    }

    return result;
  },

  /**
   * Reject a claim.
   */
  async rejectClaim(
    claimId: string,
    reason: string
  ): Promise<{ success: true; data: Claim } | { success: false; error: string }> {
    const result = await safeAsync(() =>
      apiClient.put<Claim>(`/claims/${claimId}/reject`, { reason })
    );

    if (result.success) {
      dashboardEvents.emit('claim:rejected', claimId, reason);
    }

    return result;
  },

  /**
   * Fetch dashboard statistics — runs all requests in parallel.
   * Promise.all: fail-fast — if any fails, all fail.
   */
  async getDashboardStats(): Promise<{
    submitted:   number;
    underReview: number;
    approved:    number;
    rejected:    number;
    totalValue:  number;
  }> {
    // Run all status count requests simultaneously
    const [submittedPage, reviewPage, approvedPage, rejectedPage] =
      await fetchParallel(
        apiClient.get<Page<ClaimSummary>>('/claims?status=SUBMITTED&size=1'),
        apiClient.get<Page<ClaimSummary>>('/claims?status=UNDER_REVIEW&size=1'),
        apiClient.get<Page<ClaimSummary>>('/claims?status=APPROVED&size=1'),
        apiClient.get<Page<ClaimSummary>>('/claims?status=REJECTED&size=1')
      );

    return {
      submitted:   submittedPage.totalElements,
      underReview: reviewPage.totalElements,
      approved:    approvedPage.totalElements,
      rejected:    rejectedPage.totalElements,
      totalValue:  0, // would come from a dedicated endpoint in production
    };
  },
};
