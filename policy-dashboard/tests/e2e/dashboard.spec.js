import { test, expect } from '@playwright/test';
import { ClaimsDashboardPage } from './pages/ClaimsDashboardPage.js';

// ── Test data factories ────────────────────────────────────────────────────
let counter = 0;
function claim(overrides = {}) {
  counter++;
  return {
    id:          `claim-${String(counter).padStart(3,'0')}`,
    policyId:    `POL-${String(counter).padStart(3,'0')}`,
    type:        'HOME',
    status:      'SUBMITTED',
    amount:      500,
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}
const claims10 = Array.from({ length: 10 }, () => claim());
const noContent = [];

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Claims Dashboard — E2E', () => {
  let page_;

  test.beforeEach(async ({ page }) => {
    page_ = new ClaimsDashboardPage(page);
  });

  // ── Initial load ──────────────────────────────────────────────────────────

  test('shows claim cards when API returns data', async () => {
    await page_.mockClaims(claims10, 10);
    await page_.goto();
    await page_.expectClaimCount(10);
    await expect(page_.totalCount).toContainText('10');
  });

  test('shows empty state when no claims returned', async () => {
    await page_.mockClaims(noContent, 0);
    await page_.goto();
    await page_.expectEmptyState();
  });

  test('shows error message when API returns 500', async () => {
    await page_.mockApiError(500);
    await page_.goto();
    await page_.expectError();
    await expect(page_.errorMessage).toContainText('Retry');
  });

  test('shows error when network fails', async () => {
    await page_.mockNetworkFailure();
    await page_.goto();
    await page_.expectError();
  });

  // ── Search with debounce ──────────────────────────────────────────────────

  test('search filters claims by policy ID', async () => {
    const matched = [claim({ policyId: 'POL-SEARCH' })];
    await page_.page.route('**/api/v1/claims*', route => {
      const url = route.request().url();
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: {
          content:       url.includes('policyId=POL-SEARCH') ? matched : claims10,
          totalElements: url.includes('policyId=POL-SEARCH') ? 1 : 10,
          totalPages: 1, page: 0, size: 10,
        }, status: 200, message: 'OK' }),
      });
    });
    await page_.goto();
    await page_.search('POL-SEARCH');
    await page_.expectClaimCount(1);
  });

  test('empty state shown when search returns nothing', async () => {
    await page_.page.route('**/api/v1/claims*', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { content: [], totalElements: 0, totalPages: 0, page: 0, size: 10 },
          status: 200, message: 'OK' }) })
    );
    await page_.goto();
    await page_.search('UNKNOWN-999');
    await page_.expectEmptyState();
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  test('status filter sends correct query param', async () => {
    let capturedUrl = '';
    await page_.page.route('**/api/v1/claims*', route => {
      capturedUrl = route.request().url();
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { content: [], totalElements: 0, totalPages: 0, page: 0, size: 10 },
          status: 200, message: 'OK' }) });
    });
    await page_.goto();
    await page_.filterByStatus('APPROVED');
    expect(capturedUrl).toContain('status=APPROVED');
  });

  test('clear filters resets the list', async () => {
    await page_.mockClaims(claims10, 10);
    await page_.goto();
    await page_.filterByStatus('REJECTED'); // no results
    await page_.clearAllFilters();
    await page_.expectClaimCount(10);
  });

  // ── Approve / Reject ──────────────────────────────────────────────────────

  test('approve button visible only for UNDER_REVIEW claims', async () => {
    await page_.mockClaims([claim({ status: 'UNDER_REVIEW', id: 'review-001' })]);
    await page_.goto();
    await expect(page_.page.getByTestId('approve-button')).toBeVisible();
    await expect(page_.page.getByTestId('reject-button')).toBeVisible();
  });

  test('no action buttons for SUBMITTED claims', async () => {
    await page_.mockClaims([claim({ status: 'SUBMITTED' })]);
    await page_.goto();
    await expect(page_.page.getByTestId('approve-button')).not.toBeVisible();
  });

  test('shows success message after approving', async () => {
    const c = claim({ status: 'UNDER_REVIEW', id: 'approve-me' });
    await page_.mockClaims([c]);
    await page_.page.route(`**/api/v1/claims/${c.id}/approve`, route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { ...c, status: 'APPROVED' }, status: 200, message: 'OK' }) })
    );
    await page_.goto();
    await page_.page.getByTestId('approve-button').click();
    await expect(page_.actionSuccess).toBeVisible();
    await expect(page_.actionSuccess).toContainText('approved');
  });

  test('shows error when approve API fails', async () => {
    const c = claim({ status: 'UNDER_REVIEW', id: 'fail-approve' });
    await page_.mockClaims([c]);
    await page_.page.route(`**/api/v1/claims/${c.id}/approve`, route =>
      route.fulfill({ status: 422, contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid transition' }) })
    );
    await page_.goto();
    await page_.page.getByTestId('approve-button').click();
    await expect(page_.actionError).toBeVisible();
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  test('shows pagination when multiple pages exist', async () => {
    await page_.mockClaims(claims10, 25, 3);
    await page_.goto();
    await expect(page_.pageInfo).toContainText('Page 1 of 3');
  });

  test('prev button is disabled on first page', async () => {
    await page_.mockClaims(claims10, 25, 3);
    await page_.goto();
    await expect(page_.prevPage).toBeDisabled();
    await expect(page_.nextPage).not.toBeDisabled();
  });

  test('pagination hidden during search', async () => {
    await page_.mockClaims(claims10, 25, 3);
    await page_.goto();
    await expect(page_.page.getByTestId('pagination')).toBeVisible();
    await page_.search('POL-001');
    await expect(page_.page.getByTestId('pagination')).not.toBeVisible();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  test('claims list has role="list"', async () => {
    await page_.mockClaims(claims10);
    await page_.goto();
    await expect(page_.claimsList).toHaveRole('list');
  });

  test('error has role="alert"', async () => {
    await page_.mockApiError(500);
    await page_.goto();
    await expect(page_.errorMessage).toHaveRole('alert');
  });

  test('status filter has accessible label', async () => {
    await page_.mockClaims(claims10);
    await page_.goto();
    await expect(page_.statusFilter).toHaveAttribute('aria-label', 'Filter by status');
  });

  // ── Network interception capability demo ──────────────────────────────────

  test('can simulate slow API and verify loading spinner', async () => {
    await page_.page.route('**/api/v1/claims*', async route => {
      await new Promise(r => setTimeout(r, 800)); // simulate 800ms latency
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { content: [claim()], totalElements: 1,
          totalPages: 1, page: 0, size: 10 }, status: 200, message: 'OK' }) });
    });
    await page_.goto();
    await expect(page_.loadingSpinner).toBeVisible();  // visible during load
    await page_.expectClaimCount(1);
    await expect(page_.loadingSpinner).not.toBeVisible(); // gone after load
  });
});
