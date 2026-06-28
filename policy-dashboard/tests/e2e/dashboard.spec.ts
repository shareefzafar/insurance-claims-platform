/**
 * Claims Dashboard — Playwright E2E Tests
 * =========================================
 * Tests: full user journeys, network interception, API error handling,
 *        search with debounce, filter interactions, pagination, accessibility.
 *
 * PLAYWRIGHT FEATURES DEMONSTRATED:
 *  - Page Object Model (ClaimsDashboardPage encapsulates all selectors)
 *  - Network interception (route()) — no real backend required
 *  - Auto-waiting — no Thread.sleep(), no explicit waits for elements
 *  - Accessibility assertions (toHaveRole, toHaveAttribute)
 *  - Screenshots and traces on failure (configured in playwright.config.ts)
 *  - Cross-browser: Chrome, Firefox, Mobile Chrome (configured in playwright.config.ts)
 */

import { test, expect } from '@playwright/test';
import { ClaimsDashboardPage } from './pages/ClaimsDashboardPage';
import { FIXTURES, createClaim, createClaims } from './fixtures/claims.fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// SETUP — shared page object
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Claims Dashboard', () => {
  let dashboardPage: ClaimsDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new ClaimsDashboardPage(page);
  });

  // ── INITIAL LOAD ──────────────────────────────────────────────────────────

  test.describe('Initial load', () => {

    test('shows claims list when API returns data', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.tenMixedClaims, 10);
      await dashboardPage.goto();

      await dashboardPage.expectClaimCount(10);
      await expect(dashboardPage.totalCount).toContainText('10');
    });

    test('shows empty state when no claims returned', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.emptyClaims, 0);
      await dashboardPage.goto();

      await dashboardPage.expectEmptyState();
    });

    test('shows error message when API returns 500', async () => {
      await dashboardPage.mockApiError(500);
      await dashboardPage.goto();

      await dashboardPage.expectErrorMessage();
      // Error message should have a retry button
      await expect(dashboardPage.errorMessage.getByText('Retry')).toBeVisible();
    });

    test('shows error message when network fails', async () => {
      await dashboardPage.mockNetworkFailure();
      await dashboardPage.goto();

      await dashboardPage.expectErrorMessage();
    });
  });

  // ── SEARCH ────────────────────────────────────────────────────────────────

  test.describe('Search with debounce', () => {

    test('shows matching claims when searching by policy ID', async () => {
      // Mock the filtered API response
      const matchingClaim = createClaim({ policyId: 'POL-001' });

      await dashboardPage.page.route('**/api/v1/claims*', route => {
        const url = route.request().url();
        if (url.includes('policyId=POL-001')) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { content: [matchingClaim], totalElements: 1, totalPages: 1, page: 0, size: 10 },
              status: 200, message: 'OK',
            }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { content: FIXTURES.tenMixedClaims, totalElements: 10, totalPages: 1, page: 0, size: 10 },
              status: 200, message: 'OK',
            }),
          });
        }
      });

      await dashboardPage.goto();
      await dashboardPage.search('POL-001');
      // Debounce 300ms + API call + render — Playwright auto-waits

      await dashboardPage.expectClaimCount(1);
    });

    test('shows all claims after clearing search', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.tenMixedClaims, 10);
      await dashboardPage.goto();

      await dashboardPage.search('POL-001');
      await dashboardPage.clearSearch();

      await dashboardPage.expectClaimCount(10);
    });

    test('shows empty state when search returns no results', async () => {
      await dashboardPage.page.route('**/api/v1/claims*', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { content: [], totalElements: 0, totalPages: 0, page: 0, size: 10 },
            status: 200, message: 'OK',
          }),
        })
      );

      await dashboardPage.goto();
      await dashboardPage.search('UNKNOWN-POLICY');

      await dashboardPage.expectEmptyState();
    });
  });

  // ── FILTERS ───────────────────────────────────────────────────────────────

  test.describe('Filter interactions', () => {

    test('filters claims by status', async () => {
      const submittedClaims = createClaims(3, { status: 'SUBMITTED' });

      await dashboardPage.page.route('**/api/v1/claims*', route => {
        const url = route.request().url();
        if (url.includes('status=SUBMITTED')) {
          route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({
              data: { content: submittedClaims, totalElements: 3, totalPages: 1, page: 0, size: 10 },
              status: 200, message: 'OK',
            }),
          });
        } else {
          route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({
              data: { content: FIXTURES.tenMixedClaims, totalElements: 10, totalPages: 1, page: 0, size: 10 },
              status: 200, message: 'OK',
            }),
          });
        }
      });

      await dashboardPage.goto();
      await dashboardPage.filterByStatus('SUBMITTED');
      await dashboardPage.expectClaimCount(3);
    });

    test('clear filters restores full list', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.tenMixedClaims, 10);
      await dashboardPage.goto();

      await dashboardPage.filterByStatus('APPROVED');
      await dashboardPage.clearAllFilters();

      await dashboardPage.expectClaimCount(10);
    });
  });

  // ── APPROVE / REJECT ──────────────────────────────────────────────────────

  test.describe('Approve and reject actions', () => {

    test('approve button visible only for UNDER_REVIEW claims', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.singleUnderReviewClaim);
      await dashboardPage.goto();

      await expect(dashboardPage.page.getByTestId('approve-button')).toBeVisible();
      await expect(dashboardPage.page.getByTestId('reject-button')).toBeVisible();
    });

    test('action buttons not shown for SUBMITTED claims', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.singleSubmittedClaim);
      await dashboardPage.goto();

      await expect(dashboardPage.page.getByTestId('approve-button')).not.toBeVisible();
      await expect(dashboardPage.page.getByTestId('reject-button')).not.toBeVisible();
    });

    test('shows success message after approving a claim', async () => {
      const claim = createClaim({ status: 'UNDER_REVIEW', id: 'claim-to-approve' });

      await dashboardPage.mockClaimsApi([claim]);
      await dashboardPage.page.route('**/api/v1/claims/claim-to-approve/approve', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            data: { ...claim, status: 'APPROVED' },
            status: 200, message: 'OK',
          }),
        })
      );

      await dashboardPage.goto();
      await dashboardPage.page.getByTestId('approve-button').click();

      await expect(dashboardPage.actionSuccess).toBeVisible();
      await expect(dashboardPage.actionSuccess).toContainText('approved');
    });

    test('shows error message when approve API fails', async () => {
      const claim = createClaim({ status: 'UNDER_REVIEW', id: 'claim-fail' });

      await dashboardPage.mockClaimsApi([claim]);
      await dashboardPage.page.route('**/api/v1/claims/claim-fail/approve', route =>
        route.fulfill({ status: 422, contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid state transition' }) })
      );

      await dashboardPage.goto();
      await dashboardPage.page.getByTestId('approve-button').click();

      await expect(dashboardPage.actionError).toBeVisible();
    });
  });

  // ── PAGINATION ────────────────────────────────────────────────────────────

  test.describe('Pagination', () => {

    test('shows pagination when there are multiple pages', async () => {
      await dashboardPage.mockClaimsApi(createClaims(10), 25);
      await dashboardPage.goto();

      await expect(dashboardPage.pageInfo).toBeVisible();
      await expect(dashboardPage.pageInfo).toContainText('Page 1 of 3');
    });

    test('prev button is disabled on first page', async () => {
      await dashboardPage.mockClaimsApi(createClaims(10), 25);
      await dashboardPage.goto();

      await expect(dashboardPage.prevPage).toBeDisabled();
      await expect(dashboardPage.nextPage).not.toBeDisabled();
    });

    test('navigates to next page', async () => {
      let callCount = 0;
      await dashboardPage.page.route('**/api/v1/claims*', route => {
        callCount++;
        const page = callCount === 1 ? 0 : 1;
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            data: { content: createClaims(10), totalElements: 25, totalPages: 3, page, size: 10 },
            status: 200, message: 'OK',
          }),
        });
      });

      await dashboardPage.goto();
      await dashboardPage.goToNextPage();

      await expect(dashboardPage.pageInfo).toContainText('Page 2 of 3');
    });

    test('pagination hidden during search', async () => {
      await dashboardPage.mockClaimsApi(createClaims(10), 25);
      await dashboardPage.goto();

      await expect(dashboardPage.page.getByTestId('pagination')).toBeVisible();

      await dashboardPage.search('POL-001');

      // Pagination should be hidden when search is active
      await expect(dashboardPage.page.getByTestId('pagination')).not.toBeVisible();
    });
  });

  // ── ACCESSIBILITY ─────────────────────────────────────────────────────────

  test.describe('Accessibility', () => {

    test('claims list has correct ARIA role and label', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.singleSubmittedClaim);
      await dashboardPage.goto();

      await expect(dashboardPage.claimsList).toHaveRole('list');
      await expect(dashboardPage.claimsList).toHaveAttribute('aria-label', 'Claims list');
    });

    test('total count updates are announced via aria-live', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.singleSubmittedClaim, 1);
      await dashboardPage.goto();

      await expect(dashboardPage.totalCount).toHaveAttribute('aria-live', 'polite');
    });

    test('error alerts use role="alert" for immediate announcement', async () => {
      await dashboardPage.mockApiError(500);
      await dashboardPage.goto();

      await expect(dashboardPage.errorMessage).toHaveRole('alert');
    });

    test('filter dropdown has accessible label', async () => {
      await dashboardPage.mockClaimsApi(FIXTURES.tenMixedClaims);
      await dashboardPage.goto();

      await expect(dashboardPage.statusFilter).toHaveAttribute('aria-label', 'Filter by status');
    });
  });

  // ── NETWORK INTERCEPTION DEMONSTRATION ────────────────────────────────────

  test.describe('Network interception (Playwright capability)', () => {

    test('can test UI behaviour when API is slow', async () => {
      await dashboardPage.page.route('**/api/v1/claims*', async route => {
        // Simulate 1 second delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            data: { content: FIXTURES.singleSubmittedClaim, totalElements: 1, totalPages: 1, page: 0, size: 10 },
            status: 200, message: 'OK',
          }),
        });
      });

      await dashboardPage.goto();

      // Loading spinner should be visible while API is slow
      await expect(dashboardPage.loadingSpinner).toBeVisible();

      // After delay, claims should load
      await dashboardPage.expectClaimCount(1);
      await expect(dashboardPage.loadingSpinner).not.toBeVisible();
    });

    test('can test UI error handling without a real failing server', async () => {
      await dashboardPage.page.route('**/api/v1/claims*', route =>
        route.fulfill({
          status:      503,
          contentType: 'application/json',
          body:        JSON.stringify({ message: 'Service temporarily unavailable' }),
        })
      );

      await dashboardPage.goto();

      await dashboardPage.expectErrorMessage();
      // No real 503 server needed — Playwright intercepts and fakes it
    });
  });
});
