/**
 * Claims Service — business logic layer.
 * Demonstrates: async/await, parallel fetch, Observer pattern via dashboardEvents.
 */

import { apiClient } from '../utils/apiClient.js';
import { dashboardEvents } from '../utils/eventEmitter.js';

export const claimsService = {

  async getClaims({ status, type, policyId, page = 0, size = 10, sort = 'submittedAt,desc' } = {}) {
    const params = new URLSearchParams({ page, size, sort });
    if (status)   params.set('status',   status);
    if (type)     params.set('type',     type);
    if (policyId) params.set('policyId', policyId);
    return apiClient.get(`/claims?${params}`);
  },

  async getClaim(claimId) {
    return apiClient.get(`/claims/${claimId}`);
  },

  /**
   * Fetch dashboard stats — all 4 status counts in PARALLEL.
   * Sequential would take 4x the time.
   */
  async getDashboardStats() {
    const [submitted, underReview, approved, rejected] = await Promise.all([
      apiClient.get('/claims?status=SUBMITTED&size=1'),
      apiClient.get('/claims?status=UNDER_REVIEW&size=1'),
      apiClient.get('/claims?status=APPROVED&size=1'),
      apiClient.get('/claims?status=REJECTED&size=1'),
    ]);
    return {
      submitted:   submitted?.totalElements   ?? 0,
      underReview: underReview?.totalElements ?? 0,
      approved:    approved?.totalElements    ?? 0,
      rejected:    rejected?.totalElements    ?? 0,
    };
  },

  async submitClaim(request) {
    const claim = await apiClient.post('/claims', request);
    dashboardEvents.emit('claim:submitted', claim.id, claim.amount);
    return claim;
  },

  async approveClaim(claimId) {
    try {
      const claim = await apiClient.put(`/claims/${claimId}/approve`, {});
      dashboardEvents.emit('claim:approved', claimId, claim.amount);
      return { success: true, data: claim };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async rejectClaim(claimId, reason) {
    try {
      const claim = await apiClient.put(`/claims/${claimId}/reject`, { reason });
      dashboardEvents.emit('claim:rejected', claimId, reason);
      return { success: true, data: claim };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
