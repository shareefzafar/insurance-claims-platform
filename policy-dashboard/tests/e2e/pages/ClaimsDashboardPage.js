import { expect } from '@playwright/test';

/**
 * Page Object Model — Claims Dashboard
 * All selectors in one place. UI change = update this file only. (SRP)
 * Playwright auto-waits on all locator operations — no explicit waits needed.
 */
export class ClaimsDashboardPage {
  constructor(page) {
    this.page = page;
    // data-testid selectors — stable, decoupled from CSS and content
    this.dashboard      = page.getByTestId('claims-dashboard');
    this.searchInput    = page.getByTestId('search-input');
    this.statusFilter   = page.getByTestId('status-filter');
    this.typeFilter     = page.getByTestId('type-filter');
    this.clearFilters   = page.getByTestId('clear-filters');
    this.claimsList     = page.getByTestId('claims-list');
    this.loadingSpinner = page.getByTestId('loading-spinner');
    this.errorMessage   = page.getByTestId('error-message');
    this.emptyState     = page.getByTestId('empty-state');
    this.totalCount     = page.getByTestId('total-count');
    this.prevPage       = page.getByTestId('prev-page');
    this.nextPage       = page.getByTestId('next-page');
    this.pageInfo       = page.getByTestId('page-info');
    this.actionSuccess  = page.getByTestId('action-success');
    this.actionError    = page.getByTestId('action-error');
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.dashboard).toBeVisible();
  }

  getClaimCards() { return this.page.getByTestId('claim-card'); }

  async search(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(400); // wait for 300ms debounce + render
  }

  async filterByStatus(status) {
    await this.statusFilter.selectOption(status);
    await this.waitForLoad();
  }

  async filterByType(type) {
    await this.typeFilter.selectOption(type);
    await this.waitForLoad();
  }

  async clearAllFilters() {
    await this.clearFilters.click();
    await this.waitForLoad();
  }

  async waitForLoad() {
    await expect(this.loadingSpinner).not.toBeVisible({ timeout: 10_000 });
  }

  async expectClaimCount(n) {
    await expect(this.getClaimCards()).toHaveCount(n);
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }

  /** Intercept API and return mock claims */
  async mockClaims(claims, totalElements = claims.length, totalPages = 1) {
    await this.page.route('**/api/v1/claims*', route =>
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { content: claims, totalElements, totalPages, page: 0, size: 10 },
          status: 200, message: 'OK',
        }),
      })
    );
  }

  async mockApiError(status = 500) {
    await this.page.route('**/api/v1/claims*', route =>
      route.fulfill({ status, contentType: 'application/json',
        body: JSON.stringify({ message: 'Error' }) })
    );
  }

  async mockNetworkFailure() {
    await this.page.route('**/api/v1/claims*', route => route.abort('failed'));
  }
}
