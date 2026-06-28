/**
 * Custom React Hooks
 * ===================
 * Demonstrates: closures in React, useEffect cleanup, generic hooks,
 *               async state management, TypeScript with React.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce, debounceCancellable } from '@/utils/debounce';
import { claimsService } from '@/services/claimsService';
import type {
  ClaimSummary,
  ClaimFilters,
  Page,
  SortState,
  PaginationState,
} from '@/types/policy.types';

// ─────────────────────────────────────────────────────────────────────────────
// useDebounce — debounces a value
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Debounces a value — returns the debounced value after `delay` ms of no changes.
 *
 * CLOSURE in React:
 *   useEffect creates a timer that closes over `value`.
 *   When value changes: the old timer is cancelled (cleanup), new one scheduled.
 *   Only the final value after the user stops changing fires.
 *
 * Generic T: useDebounce<string>(''), useDebounce<number>(0) — type inferred.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Schedule update after delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // CLEANUP: if value changes before delay expires, cancel the previous timer
    // This is the closure — timer is captured by the cleanup function
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// useClaims — fetches and manages claim list state
// ─────────────────────────────────────────────────────────────────────────────

interface UseClaimsState {
  claims:     ClaimSummary[];
  page:       Page<ClaimSummary> | null;
  loading:    boolean;
  error:      string | null;
  refetch:    () => void;
}

/**
 * Hook that manages claims fetching with filters, sort, and pagination.
 *
 * CLOSURE in useCallback:
 *   fetchClaims closes over filters, sort, pagination.
 *   useCallback memoises it — only recreates when dependencies change.
 *   Without memoisation: new function on every render → infinite useEffect loop.
 */
export function useClaims(
  filters: ClaimFilters = {},
  sort: SortState = { field: 'submittedAt', order: 'desc' },
  pagination: PaginationState = { page: 0, size: 20 }
): UseClaimsState {
  const [claims, setClaims]   = useState<ClaimSummary[]>([]);
  const [page, setPage]       = useState<Page<ClaimSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await claimsService.getClaims(filters, sort, pagination);
      setClaims(result.content);
      setPage(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.status, filters.type, filters.policyId,
    filters.dateFrom, filters.dateTo,
    sort.field, sort.order,
    pagination.page, pagination.size,
    refreshKey,
  ]);

  useEffect(() => {
    void fetchClaims();
  }, [fetchClaims]);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  return { claims, page, loading, error, refetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSearchClaims — search with debounce
// ─────────────────────────────────────────────────────────────────────────────

interface UseSearchClaimsState {
  query:     string;
  setQuery:  (q: string) => void;
  claims:    ClaimSummary[];
  loading:   boolean;
  error:     string | null;
}

/**
 * Debounced search — API call only fires 300ms after user stops typing.
 * Demonstrates: debounce + closure + async state in one hook.
 */
export function useSearchClaims(): UseSearchClaimsState {
  const [query, setQuery]     = useState('');
  const [claims, setClaims]   = useState<ClaimSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Debounced query — only triggers useEffect after 300ms of silence
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setClaims([]);
      return;
    }

    let cancelled = false; // prevents state updates if component unmounts

    const search = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await claimsService.getClaims(
          { policyId: debouncedQuery },
          { field: 'submittedAt', order: 'desc' },
          { page: 0, size: 10 }
        );
        if (!cancelled) setClaims(result.content);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void search();

    // Cleanup: mark as cancelled if component unmounts or query changes
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  return { query, setQuery, claims, loading, error };
}
