/**
 * ClaimsDashboard — main UI component.
 * Manages state, renders UI, wires up all interactions.
 * Demonstrates: closures, debounce, async/await, DOM manipulation,
 *               Observer pattern (dashboardEvents).
 */

import { claimsService }       from '../services/claimsService.js';
import { createClaimCard }     from './ClaimCard.js';
import { debounce }            from '../utils/debounce.js';
import { dashboardEvents }     from '../utils/eventEmitter.js';

export function createDashboard(rootEl) {

  // ── STATE ─────────────────────────────────────────────────────────────────
  // Plain object — no framework needed for this scale
  let state = {
    claims:      [],
    page:        null,
    loading:     false,
    error:       null,
    currentPage: 0,
    filters:     { status: '', type: '' },
    sort:        'submittedAt,desc',
    searchQuery: '',
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  function render() {
    rootEl.innerHTML = `
      <div class="claims-dashboard" data-testid="claims-dashboard">
        <header class="dashboard-header">
          <h1>Policy Claims Dashboard</h1>
          ${state.page
            ? `<span data-testid="total-count" aria-live="polite">${state.page.totalElements} claims</span>`
            : ''}
        </header>

        <div class="dashboard-controls">
          <div class="search-bar">
            <input type="search" data-testid="search-input"
                   placeholder="Search by policy ID..."
                   value="${state.searchQuery}"
                   aria-label="Search claims by policy ID" />
            ${state.loading ? '<span class="search-spinner" data-testid="search-spinner" aria-label="Searching..."></span>' : ''}
          </div>

          <div class="filter-bar" data-testid="filter-bar">
            <select data-testid="status-filter" aria-label="Filter by status">
              <option value="">All Statuses</option>
              ${['SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID'].map(s =>
                `<option value="${s}" ${state.filters.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`
              ).join('')}
            </select>

            <select data-testid="type-filter" aria-label="Filter by type">
              <option value="">All Types</option>
              ${['HOME','HEALTH','VEHICLE'].map(t =>
                `<option value="${t}" ${state.filters.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>

            <button class="btn btn--secondary" data-testid="clear-filters">Clear</button>
          </div>
        </div>

        ${state.error ? `
          <div class="alert alert--error" data-testid="error-message" role="alert">
            ${state.error}
            <button class="btn btn--secondary retry-btn">Retry</button>
          </div>
        ` : ''}

        ${state.loading ? `
          <div class="loading-overlay" data-testid="loading-spinner" aria-label="Loading claims">
            Loading...
          </div>
        ` : ''}

        ${!state.loading && !state.error && state.claims.length === 0 ? `
          <div class="empty-state" data-testid="empty-state">
            <p>No claims found. Try adjusting your filters.</p>
          </div>
        ` : ''}

        <div class="claims-list" data-testid="claims-list"
             role="list" aria-label="Claims list"></div>

        ${!state.searchQuery && state.page && state.page.totalPages > 1 ? `
          <div class="pagination" data-testid="pagination">
            <button class="btn btn--secondary" data-testid="prev-page"
                    ${state.currentPage === 0 ? 'disabled' : ''}
                    aria-label="Previous page">← Prev</button>
            <span data-testid="page-info" aria-live="polite">
              Page ${state.currentPage + 1} of ${state.page.totalPages}
            </span>
            <button class="btn btn--secondary" data-testid="next-page"
                    ${state.currentPage >= state.page.totalPages - 1 ? 'disabled' : ''}
                    aria-label="Next page">Next →</button>
          </div>
        ` : ''}
      </div>
    `;

    // Render claim cards into the list (DOM nodes, not innerHTML strings)
    const list = rootEl.querySelector('[data-testid="claims-list"]');
    state.claims.forEach(claim => {
      list.appendChild(createClaimCard(claim, {
        onSelect:  (id)          => handleSelect(id),
        onApprove: (id)          => handleApprove(id),
        onReject:  (id)          => handleReject(id),
      }));
    });

    bindEvents();
  }

  // ── EVENT BINDING ─────────────────────────────────────────────────────────

  function bindEvents() {
    // Search — debounced 300ms, only fires API after user stops typing
    const searchInput = rootEl.querySelector('[data-testid="search-input"]');
    if (searchInput) {
      searchInput.addEventListener('input', debouncedSearch);
      // Restore focus position after re-render
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }

    rootEl.querySelector('[data-testid="status-filter"]')
      ?.addEventListener('change', e => {
        state.filters.status = e.target.value;
        state.currentPage = 0;
        loadClaims();
      });

    rootEl.querySelector('[data-testid="type-filter"]')
      ?.addEventListener('change', e => {
        state.filters.type = e.target.value;
        state.currentPage = 0;
        loadClaims();
      });

    rootEl.querySelector('[data-testid="clear-filters"]')
      ?.addEventListener('click', () => {
        state.filters = { status: '', type: '' };
        state.searchQuery = '';
        state.currentPage = 0;
        loadClaims();
      });

    rootEl.querySelector('.retry-btn')
      ?.addEventListener('click', loadClaims);

    rootEl.querySelector('[data-testid="prev-page"]')
      ?.addEventListener('click', () => { state.currentPage--; loadClaims(); });

    rootEl.querySelector('[data-testid="next-page"]')
      ?.addEventListener('click', () => { state.currentPage++; loadClaims(); });
  }

  // ── ACTIONS ───────────────────────────────────────────────────────────────

  function handleSelect(claimId) {
    dashboardEvents.emit('claim:selected', claimId);
    // Highlight selected card
    rootEl.querySelectorAll('.claim-card').forEach(c => c.classList.remove('claim-card--selected'));
    rootEl.querySelector(`[data-claim-id="${claimId}"]`)?.classList.add('claim-card--selected');
  }

  async function handleApprove(claimId) {
    const result = await claimsService.approveClaim(claimId);
    if (result.success) {
      showAlert(`Claim ${claimId} approved successfully`, 'success');
      loadClaims();
    } else {
      showAlert(result.error, 'error');
    }
  }

  async function handleReject(claimId) {
    const result = await claimsService.rejectClaim(claimId, 'Rejected via dashboard');
    if (result.success) {
      showAlert(`Claim ${claimId} rejected`, 'success');
      loadClaims();
    } else {
      showAlert(result.error, 'error');
    }
  }

  // ── DATA LOADING ──────────────────────────────────────────────────────────

  async function loadClaims() {
    state.loading = true;
    state.error   = null;
    render();

    try {
      const result = await claimsService.getClaims({
        ...state.filters,
        policyId: state.searchQuery || undefined,
        page:     state.currentPage,
        size:     10,
        sort:     state.sort,
      });

      state.claims = result?.content ?? result ?? [];
      state.page   = result;
    } catch (err) {
      state.error  = err.message || 'Failed to load claims';
      state.claims = [];
    } finally {
      state.loading = false;
      render();
    }
  }

  // Debounced search — the returned function closes over debouncedSearch
  const debouncedSearch = debounce(function(e) {
    state.searchQuery = e.target.value.trim();
    state.currentPage = 0;
    loadClaims();
  }, 300);

  // ── ALERT ─────────────────────────────────────────────────────────────────

  function showAlert(message, type = 'success') {
    const existing = rootEl.querySelector('.dashboard-alert');
    existing?.remove();

    const alert = document.createElement('div');
    alert.className   = `alert alert--${type} dashboard-alert`;
    alert.dataset.testid = type === 'error' ? 'action-error' : 'action-success';
    alert.setAttribute('role', type === 'error' ? 'alert' : 'status');
    alert.textContent = message;

    rootEl.querySelector('.dashboard-controls')?.after(alert);
    setTimeout(() => alert.remove(), 4000); // auto-dismiss
  }

  // ── OBSERVER SUBSCRIPTIONS ────────────────────────────────────────────────

  // Listen for events from other parts of the app
  dashboardEvents.on('claim:submitted', (claimId) => {
    console.log(`[Dashboard] New claim submitted: ${claimId} — refreshing list`);
    loadClaims();
  });

  // ── INIT ──────────────────────────────────────────────────────────────────

  loadClaims(); // initial load
  return { reload: loadClaims }; // expose for external control
}
