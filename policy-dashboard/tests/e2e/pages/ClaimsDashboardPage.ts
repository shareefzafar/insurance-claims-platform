/**
 * PLAYWRIGHT PAGE OBJECT MODEL
 * ==============================
 * Encapsulates all selectors and actions for the Claims Dashboard.
 *
 * WHY PAGE OBJECT MODEL?
 *   Without POM: selectors scattered across all test files.
 *                UI change requires updating every test file.
 *
 *   With POM:    selectors in ONE class.
 *                UI change: update this file only — all tests still pass.
 *                SRP applied to E2E testing.
 *
 * PLAYWRIGHT ADVANTAGES demonstrated:
 *   - Auto-waiting: fill(), click(), waitForSelector() all wait automatically
 *   - No Thread.sleep() / WebDriverWait boilerplate
 *   - Network interception: route() mocks API responses inline
 *   - Trace viewer, video, screenshot on failure via playwright.config.ts
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class ClaimsDashboardPage {
  readonly page: Page;

  // Locators — defined once, used in all actions and assertions
  readonly dashboard:     Locator;
  readonly searchInput:   Locator;
  readonly searchSpinner: Locator;
  readonly statusFilter:  Locator;
  readonly typeFilter:    Locator;
  readonly clearFilters:  Locator;
  readonly sortField:     Locator;
  readonly sortOrder:     Locator;
  readonly claimsList:    Locator;
  readonly loadingSpinner:Locator;
  readonly errorMessage:  Locator;
  readonly emptyState:    Locator;
  readonly totalCount:    Locator;
  readonly prevPage:      Locator;
  readonly nextPage:      Locator;
  readonly pageInfo:      Locator;
  readonly actionSuccess: Locator;
  readonly actionError:   Locator;

  constructor(page: Page) {
    this.page = page;

    // All selectors use data-testid — stable, decoupled from CSS and text
    this.dashboard      = page.getByTestId('claims-dashboard');
    this.searchInput    = page.getByTestId('search-input');
    this.searchSpinner  = page.getByTestId('search-spinner');
    this.statusFilter   = page.getByTestId('status-filter');
    this.typeFilter     = page.getByTestId('type-filter');
    this.clearFilters   = page.getByTestId('clear-filters');
    this.sortField      = page.getByTestId('sort-field');
    this.sortOrder      = page.getByTestId('sort-order');
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

  // ── NAVIGATION ────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/');
    // Playwright auto-waits for the dashboard to appear — no explicit wait needed
    await expect(this.dashboard).toBeVisible();
  }

  // ── SEARCH ACTIONS ────────────────────────────────────────────────────────

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Debounce: wait 400ms for the debounced API call to fire
    // (debounce delay is 300ms — 400ms ensures it has fired)
    await this.page.waitForTimeout(400);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(400);
  }

  // ── FILTER ACTIONS ────────────────────────────────────────────────────────

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status);
    await this.waitForListToLoad();
  }

  async filterByType(type: string): Promise<void> {
    await this.typeFilter.selectOption(type);
    await this.waitForListToLoad();
  }

  async clearAllFilters(): Promise<void> {
    await this.clearFilters.click();
    await this.waitForListToLoad();
  }

  // ── CLAIM CARD ACTIONS ────────────────────────────────────────────────────

  getClaimCards(): Locator {
    return this.page.getByTestId('claim-card');
  }

  getClaimCardById(claimId: string): Locator {
    return this.page.locator(`[data-claim-id="${claimId}"]`);
  }

  async selectClaim(index: number): Promise<void> {
    await this.getClaimCards().nth(index).click();
  }

  async approveClaim(index: number): Promise<void> {
    const card = this.getClaimCards().nth(index);
    await card.getByTestId('approve-button').click();
    // Playwright auto-waits for the success message
    await expect(this.actionSuccess).toBeVisible();
  }

  async rejectClaim(index: number): Promise<void> {
    const card = this.getClaimCards().nth(index);
    await card.getByTestId('reject-button').click();
    await expect(this.actionSuccess).toBeVisible();
  }

  // ── PAGINATION ACTIONS ────────────────────────────────────────────────────

  async goToNextPage(): Promise<void> {
    await this.nextPage.click();
    await this.waitForListToLoad();
  }

  async goToPrevPage(): Promise<void> {
    await this.prevPage.click();
    await this.waitForListToLoad();
  }

  // ── ASSERTIONS ────────────────────────────────────────────────────────────

  async expectClaimCount(count: number): Promise<void> {
    await expect(this.getClaimCards()).toHaveCount(count);
  }

  async expectClaimVisible(claimId: string): Promise<void> {
    await expect(this.getClaimCardById(claimId)).toBeVisible();
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
    await expect(this.getClaimCards()).toHaveCount(0);
  }

  async expectLoadingSpinner(): Promise<void> {
    await expect(this.loadingSpinner).toBeVisible();
  }

  async expectErrorMessage(text?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text);
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  async waitForListToLoad(): Promise<void> {
    // Wait for loading spinner to disappear — Playwright polls automatically
    await expect(this.loadingSpinner).not.toBeVisible({ timeout: 10_000 });
  }

  /**
   * Intercept API calls and return mock data.
   * Demonstrates Playwright network interception — no real backend needed for E2E.
   */
  async mockClaimsApi(claims: unknown[], totalElements = claims.length): Promise<void> {
    await this.page.route('**/api/v1/claims*', route => {
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            content:       claims,
            totalElements: totalElements,
            totalPages:    Math.ceil(totalElements / 10),
            page:          0,
            size:          10,
          },
          status:  200,
          message: 'OK',
        }),
      });
    });
  }

  async mockApiError(statusCode = 500): Promise<void> {
    await this.page.route('**/api/v1/claims*', route => {
      route.fulfill({
        status:      statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service unavailable' }),
      });
    });
  }

  async mockNetworkFailure(): Promise<void> {
    await this.page.route('**/api/v1/claims*', route => {
      route.abort('failed');
    });
  }
}
