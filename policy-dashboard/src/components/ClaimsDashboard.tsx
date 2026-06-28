/**
 * ClaimsDashboard — Main Dashboard Component
 * ============================================
 * Demonstrates: React state management, TypeScript discriminated unions,
 *               custom hooks, event handling, conditional rendering.
 */

import React, { useState, useCallback } from 'react';
import { ClaimCard }    from './ClaimCard';
import { useClaims, useSearchClaims } from '@/hooks/useClaims';
import { claimsService }  from '@/services/claimsService';
import type {
  ClaimStatus,
  ClaimType,
  ClaimFilters,
  SortState,
  SortField,
  SortOrder,
} from '@/types/policy.types';

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters:   ClaimFilters;
  onChange:  (filters: ClaimFilters) => void;
}

function FilterBar({ filters, onChange }: FilterBarProps): React.ReactElement {
  return (
    <div className="filter-bar" data-testid="filter-bar">
      <select
        data-testid="status-filter"
        value={filters.status ?? ''}
        onChange={e => onChange({
          ...filters,
          status: (e.target.value as ClaimStatus) || undefined,
        })}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        <option value="SUBMITTED">Submitted</option>
        <option value="UNDER_REVIEW">Under Review</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="PAID">Paid</option>
      </select>

      <select
        data-testid="type-filter"
        value={filters.type ?? ''}
        onChange={e => onChange({
          ...filters,
          type: (e.target.value as ClaimType) || undefined,
        })}
        aria-label="Filter by type"
      >
        <option value="">All Types</option>
        <option value="HOME">Home</option>
        <option value="HEALTH">Health</option>
        <option value="VEHICLE">Vehicle</option>
      </select>

      <button
        data-testid="clear-filters"
        onClick={() => onChange({})}
        className="btn btn--secondary"
      >
        Clear
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH BAR
// ─────────────────────────────────────────────────────────────────────────────

interface SearchBarProps {
  value:    string;
  onChange: (value: string) => void;
  loading:  boolean;
}

function SearchBar({ value, onChange, loading }: SearchBarProps): React.ReactElement {
  return (
    <div className="search-bar">
      <input
        type="search"
        data-testid="search-input"
        placeholder="Search by policy ID..."
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Search claims by policy ID"
      />
      {loading && (
        <span
          className="search-spinner"
          data-testid="search-spinner"
          aria-label="Searching..."
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SORT CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

interface SortControlsProps {
  sort:     SortState;
  onChange: (sort: SortState) => void;
}

function SortControls({ sort, onChange }: SortControlsProps): React.ReactElement {
  return (
    <div className="sort-controls" data-testid="sort-controls">
      <select
        data-testid="sort-field"
        value={sort.field}
        onChange={e => onChange({ ...sort, field: e.target.value as SortField })}
        aria-label="Sort by field"
      >
        <option value="submittedAt">Date Submitted</option>
        <option value="amount">Amount</option>
        <option value="status">Status</option>
      </select>
      <button
        data-testid="sort-order"
        onClick={() => onChange({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' })}
        aria-label={`Sort ${sort.order === 'asc' ? 'descending' : 'ascending'}`}
        className="btn btn--icon"
      >
        {sort.order === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage:  number;
  totalPages:   number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps): React.ReactElement | null {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination" data-testid="pagination">
      <button
        data-testid="prev-page"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
        className="btn btn--secondary"
      >
        ← Prev
      </button>
      <span data-testid="page-info" aria-live="polite">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        data-testid="next-page"
        disabled={currentPage >= totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
        className="btn btn--secondary"
      >
        Next →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export function ClaimsDashboard(): React.ReactElement {
  const [filters,    setFilters]    = useState<ClaimFilters>({});
  const [sort,       setSort]       = useState<SortState>({ field: 'submittedAt', order: 'desc' });
  const [currentPage, setCurrentPage] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { claims, page, loading, error, refetch } = useClaims(
    filters, sort, { page: currentPage, size: 10 }
  );
  const search = useSearchClaims();

  // Display search results when query is active, otherwise show filtered list
  const displayedClaims = search.query ? search.claims : claims;

  const handleApprove = useCallback(async (claimId: string): Promise<void> => {
    setActionError(null);
    const result = await claimsService.approveClaim(claimId);
    if (result.success) {
      setActionSuccess(`Claim ${claimId} approved successfully`);
      refetch();
    } else {
      setActionError(result.error);
    }
  }, [refetch]);

  const handleReject = useCallback(async (claimId: string): Promise<void> => {
    setActionError(null);
    const result = await claimsService.rejectClaim(claimId, 'Rejected via dashboard');
    if (result.success) {
      setActionSuccess(`Claim ${claimId} rejected`);
      refetch();
    } else {
      setActionError(result.error);
    }
  }, [refetch]);

  return (
    <div className="claims-dashboard" data-testid="claims-dashboard">
      <header className="dashboard-header">
        <h1>Policy Claims Dashboard</h1>
        {page && (
          <span data-testid="total-count" aria-live="polite">
            {page.totalElements} claims
          </span>
        )}
      </header>

      <div className="dashboard-controls">
        <SearchBar
          value={search.query}
          onChange={search.setQuery}
          loading={search.loading}
        />
        <FilterBar filters={filters} onChange={f => { setFilters(f); setCurrentPage(0); }} />
        <SortControls sort={sort} onChange={setSort} />
      </div>

      {/* Status messages */}
      {actionError && (
        <div className="alert alert--error" data-testid="action-error" role="alert">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="alert alert--success" data-testid="action-success" role="status">
          {actionSuccess}
        </div>
      )}

      {/* Loading state */}
      {(loading || search.loading) && (
        <div className="loading-overlay" data-testid="loading-spinner" aria-label="Loading claims">
          Loading...
        </div>
      )}

      {/* Error state */}
      {(error ?? search.error) && (
        <div className="alert alert--error" data-testid="error-message" role="alert">
          {error ?? search.error}
          <button onClick={refetch} className="btn btn--secondary">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && displayedClaims.length === 0 && (
        <div className="empty-state" data-testid="empty-state">
          <p>No claims found. Try adjusting your filters.</p>
        </div>
      )}

      {/* Claims list */}
      <div
        className="claims-list"
        data-testid="claims-list"
        role="list"
        aria-label="Claims list"
      >
        {displayedClaims.map(claim => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}
      </div>

      {/* Pagination — hidden during search */}
      {!search.query && page && (
        <Pagination
          currentPage={currentPage}
          totalPages={page.totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
