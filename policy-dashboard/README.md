# Policy Dashboard

React + TypeScript frontend for the InsureCo Software Engineer client round.
Demonstrates JavaScript core concepts, TypeScript strict mode, design patterns,
and automated UI testing with Jest and Playwright.

---

## Project Structure

```
policy-dashboard/
├── src/
│   ├── types/
│   │   └── policy.types.ts        ← Discriminated unions, generics, utility types
│   ├── utils/
│   │   ├── debounce.ts            ← Closures + timers (debounce + throttle)
│   │   ├── eventEmitter.ts        ← TypedEventEmitter + Observer pattern
│   │   └── promiseUtils.ts        ← retry, withTimeout, safeAsync, async generators
│   ├── services/
│   │   ├── apiClient.ts           ← Generic typed HTTP client with retry
│   │   └── claimsService.ts       ← Domain service, parallel fetching
│   ├── hooks/
│   │   └── useClaims.ts           ← useDebounce, useClaims, useSearchClaims
│   ├── components/
│   │   ├── ClaimCard.tsx          ← React component, TypeScript props
│   │   └── ClaimsDashboard.tsx    ← Main dashboard, state management
│   ├── main.tsx
│   └── styles.css
├── tests/
│   ├── unit/
│   │   ├── debounce.test.ts       ← Debounce + throttle unit tests (fake timers)
│   │   ├── eventEmitter.test.ts   ← TypedEventEmitter unit tests
│   │   ├── promiseUtils.test.ts   ← retry, timeout, safeAsync tests
│   │   ├── types.test.ts          ← Discriminated union runtime tests
│   │   └── ClaimCard.test.tsx     ← React component tests (@testing-library)
│   ├── e2e/
│   │   ├── pages/
│   │   │   └── ClaimsDashboardPage.ts ← Playwright Page Object Model
│   │   ├── fixtures/
│   │   │   └── claims.fixtures.ts ← Typed test data factories
│   │   └── dashboard.spec.ts      ← Playwright E2E tests
│   └── setup.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── jest.config.ts
└── playwright.config.ts
```

---

## JavaScript Core Concepts

### Closures

Three files demonstrate closures with real use cases:

**`utils/debounce.ts`**
```javascript
function debounce(fn, wait) {
    let timerId = null;
    // ^ timerId is in the CLOSURE — persists between calls to the returned function
    // ^ Without closure: timerId would be a new variable on every call — debounce impossible

    return function(...args) {
        clearTimeout(timerId);        // cancel previous — user still typing
        timerId = setTimeout(() => {  // schedule new call
            fn.apply(this, args);
            timerId = null;
        }, wait);
    };
}
```

**`utils/eventEmitter.ts`** — `once()` method
```javascript
once(event, listener) {
    const wrapper = (...args) => {
        listener(...args);            // call original
        this.off(event, wrapper);     // wrapper closes over itself — removes itself
    };
    return this.on(event, wrapper);
}
```

**`hooks/useClaims.ts`** — React hook cleanup
```javascript
useEffect(() => {
    let cancelled = false; // closure variable

    const search = async () => {
        const result = await claimsService.getClaims(...);
        if (!cancelled) setClaims(result.content); // closure prevents stale update
    };

    search();
    return () => { cancelled = true; }; // cleanup closes over cancelled
}, [debouncedQuery]);
```

---

### Event Loop — Async Patterns

**`utils/promiseUtils.ts`**

```javascript
// SEQUENTIAL (SLOW): 300ms + 200ms = 500ms
const policy = await fetchPolicy(id);
const claims = await fetchClaims(id);

// PARALLEL (FAST): max(300ms, 200ms) = 300ms
const [policy, claims] = await Promise.all([fetchPolicy(id), fetchClaims(id)]);
```

**`services/claimsService.ts`** — dashboard stats run four requests simultaneously:
```typescript
const [submittedPage, reviewPage, approvedPage, rejectedPage] = await fetchParallel(
    apiClient.get<Page<ClaimSummary>>('/claims?status=SUBMITTED&size=1'),
    apiClient.get<Page<ClaimSummary>>('/claims?status=UNDER_REVIEW&size=1'),
    apiClient.get<Page<ClaimSummary>>('/claims?status=APPROVED&size=1'),
    apiClient.get<Page<ClaimSummary>>('/claims?status=REJECTED&size=1')
);
// Four API calls simultaneously — not sequentially
```

---

### Async Generators — Lazy Pagination

**`utils/promiseUtils.ts`** — `fetchAllPages()`
```typescript
async function* fetchAllPages(fetchFn, options) {
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
        const result = await fetchFn(page, size);
        totalPages = result.totalPages;
        yield result.content; // pause, give caller this page
        page++;
    }
}

// Usage: process 20 claims at a time, never 10,000 at once
for await (const batch of fetchAllPages(fetchClaims, { size: 20 })) {
    await processBatch(batch);
}
```

---

## TypeScript Type System

### Strict Mode

`tsconfig.json` enables all strict checks:
- `strictNullChecks` — `null | undefined` not assignable to other types
- `noImplicitAny` — all parameters must be typed
- `strictFunctionTypes` — function parameters checked covariantly
- `noUnusedLocals` / `noUnusedParameters` — dead code caught at compile time

**What strict mode catches (`utils/promiseUtils.ts` example):**
```typescript
// Without strict: calculatePremium(null, 8) returns 0 — silent wrong result
// With strict:
async function getClaim(id: string): Promise<Claim> {
    // catch binding is 'unknown' in strict mode — must narrow before use
    } catch (err: unknown) {
        if (err instanceof HttpError) return null;
        throw err; // rethrow unknowns — never swallow
    }
}
```

---

### Discriminated Unions

**`src/types/policy.types.ts`**

```typescript
// Each union member has a unique 'type' literal field (the discriminant)
export type ClaimEvent =
  | { type: 'SUBMITTED';    claimId: string; amount: number }
  | { type: 'UNDER_REVIEW'; claimId: string; reviewedBy: string }
  | { type: 'APPROVED';     claimId: string; approvedBy: string; payout: number }
  | { type: 'REJECTED';     claimId: string; reason: string }
  | { type: 'PAID';         claimId: string; transactionId: string };

// TypeScript narrows automatically in each switch case
function getClaimEventSummary(event: ClaimEvent): string {
    switch (event.type) {
        case 'SUBMITTED':
            return `Submitted for $${event.amount}`;
            // TypeScript knows: event.reviewedBy does NOT exist here
        case 'APPROVED':
            return `Approved. Payout: $${event.payout} by ${event.approvedBy}`;
            // TypeScript knows: event.amount does NOT exist here
        default:
            const _exhaustive: never = event; // compile error if case is missing
            throw new Error(`Unhandled: ${JSON.stringify(_exhaustive)}`);
    }
}
```

Add a new union member → TypeScript compile error at the `never` line until handled.

---

### Generics

**`utils/debounce.ts`**
```typescript
// T is inferred from the wrapped function — caller never specifies explicitly
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
    fn: T,
    wait: number
): (...args: Parameters<T>) => void
```

**`utils/eventEmitter.ts`** — typed event map
```typescript
type DashboardEvents = {
    'claim:approved':  [claimId: string, payout: number];
    'claim:rejected':  [claimId: string, reason: string];
};

// TypeScript enforces correct argument types at every emit() and on() call
dashboardEvents.emit('claim:approved', 'C001', 500);  // OK
dashboardEvents.emit('claim:approved', 500, 'C001');  // Compile error — wrong order
```

**`services/apiClient.ts`** — type flows through HTTP call
```typescript
// T inferred from the call site — no casting needed
async get<T>(path: string): Promise<T>

client.get<Policy>('/policies/P001')       // returns Promise<Policy>
client.get<Page<Claim>>('/claims')          // returns Promise<Page<Claim>>
```

---

### Utility Types

**`src/types/policy.types.ts`** — five utility types demonstrated
```typescript
type ClaimFormState    = Partial<CreateClaimRequest>;          // all optional (PATCH)
type ClaimSummary      = Pick<Claim, 'id' | 'status' | 'amount'>; // subset for list
type ClaimPublicView   = Omit<Claim, 'holderEmail'>;           // exclude sensitive
type ClaimStatusCounts = Record<ClaimStatus, number>;          // count per status
```

---

## Design Patterns

### Observer Pattern — TypedEventEmitter

**`utils/eventEmitter.ts`**

Type-safe event bus for dashboard-wide communication. Components subscribe to events
without knowing which other components published them.

```typescript
// Publisher (claimsService.ts) — does not know who is listening
dashboardEvents.emit('claim:approved', claimId, payout);

// Subscriber (any component) — does not know who published
dashboardEvents.on('claim:approved', (claimId, payout) => {
    showToast(`Claim ${claimId} approved. Payout: $${payout}`);
});
```

### Singleton Pattern — API Client + Event Bus

**`services/apiClient.ts`** — single `apiClient` instance shared across the app
**`utils/eventEmitter.ts`** — single `dashboardEvents` instance as global event bus

```typescript
// Module-level singleton — JavaScript module system guarantees one instance
export const apiClient = new ApiClient({ baseUrl: '/api/v1', ... });
export const dashboardEvents = new TypedEventEmitter<DashboardEvents>();
```

---

## Automated Testing

### Unit Tests — Jest

```bash
npm test            # all unit tests with coverage
npm run test:unit   # unit tests only
```

**`tests/unit/debounce.test.ts`** — fake timers
- Does not call fn immediately
- Calls fn after the wait period
- Cancels previous call when invoked again within wait period
- Forwards all arguments to the wrapped function
- `throttle()` fires first call; `debounce()` fires last call
- `cancel()` prevents pending call from firing (component unmount use case)

**`tests/unit/eventEmitter.test.ts`**
- Listener called when event emitted
- Multiple listeners all fire
- `off()` removes only the specified listener
- `once()` fires exactly one time
- Snapshot before iterate — listener removing itself during emit does not break others
- `removeAllListeners()` clears all events

**`tests/unit/promiseUtils.test.ts`**
- Returns result immediately on first success
- Retries on failure and succeeds on second attempt
- Throws last error after all attempts exhausted
- Does not retry when `isRetryable` returns false
- Exponential backoff timing verified
- `withTimeout()` rejects when promise exceeds limit
- `safeAsync()` returns success/failure Result without try/catch at call site

**`tests/unit/ClaimCard.test.tsx`** — @testing-library/react
- Renders claim type, ID, policy ID, amount, status badge
- Calls `onSelect` with correct claim ID on click
- Calls `onSelect` on Enter key (keyboard accessibility)
- Approve/reject buttons shown only for UNDER_REVIEW claims
- Approve button click calls `onApprove`, does not propagate to card
- ARIA roles, aria-label, aria-selected, tabIndex tested

Coverage gate: **80%** lines, functions, statements enforced by Jest.

---

### E2E Tests — Playwright

```bash
npm run test:e2e         # headless
npm run test:e2e:headed  # headed (watch browser)
npm run test:e2e:ui      # Playwright UI mode (interactive)
```

**Page Object Model** — `tests/e2e/pages/ClaimsDashboardPage.ts`
All selectors in one class. UI changes: update this file only.
Playwright feature: `data-testid` selectors, auto-waiting, network interception.

**`tests/e2e/dashboard.spec.ts`** covers:

| Category | Tests |
|---|---|
| Initial load | Claims list, empty state, 500 error, network failure |
| Search | Matching claims, clear search, no results empty state |
| Filters | Filter by status, clear restores full list |
| Approve/Reject | Buttons visibility, success message, error handling |
| Pagination | Shown for multi-page, prev disabled on first, navigate pages, hidden during search |
| Accessibility | ARIA roles, aria-live, aria-label, role="alert" |
| Network interception | Slow API shows spinner, 503 shows error — no real server needed |

**Cross-browser**: Chrome, Firefox, Mobile Chrome (configured in `playwright.config.ts`).

---

## Running the Project

### Prerequisites
- Node.js 20+
- npm 10+

### Development
```bash
npm install
npm run dev          # http://localhost:3000 (proxies /api to localhost:8080)
```

### Tests
```bash
npm test             # unit tests
npm run test:e2e     # E2E (starts dev server automatically)
npm run typecheck    # TypeScript check without building
npm run lint         # ESLint
```

### Build
```bash
npm run build        # TypeScript compile + Vite bundle → dist/
npm run preview      # preview the production build
```

---

## Integration with Project 1 (Claims Microservice)

The dashboard consumes the Spring Boot Claims API directly.
The Vite dev server proxies `/api` requests to `localhost:8080`.

```
Browser → http://localhost:3000/api/v1/claims
         → Vite proxy
         → http://localhost:8080/api/v1/claims  (Project 1 — Spring Boot)
```

In production: both deployed behind a load balancer or API gateway.
In E2E tests: Playwright intercepts all `/api/v1/*` calls — no real backend needed.

---

## Quick Reference — Interview Answers

**"Show me closures"**
→ `debounce.ts` — `timerId` persists between calls via closure.
→ `eventEmitter.ts` — `once()` wrapper closes over itself to remove itself.
→ `useClaims.ts` — `cancelled` flag in cleanup closes over the async operation.

**"Show me the event loop / async patterns"**
→ `promiseUtils.ts` — `fetchAllPages` async generator for lazy pagination.
→ `claimsService.ts` — `getDashboardStats()` runs four requests in parallel with `fetchParallel`.

**"Show me TypeScript discriminated unions"**
→ `policy.types.ts` — `ClaimEvent` union with exhaustiveness check (`never`).
→ `getClaimEventSummary()` — TypeScript narrows properties available in each case.

**"Show me TypeScript generics"**
→ `debounce.ts` — `T extends (...args) => ReturnType<T>` inferred from wrapped function.
→ `apiClient.ts` — `get<T>()` type flows from call site to return type.
→ `eventEmitter.ts` — `TypedEventEmitter<TEvents>` enforces correct args per event.

**"Show me Playwright"**
→ `ClaimsDashboardPage.ts` — Page Object Model, all selectors centralised.
→ `dashboard.spec.ts` — `mockClaimsApi()`, `mockApiError()`, `mockNetworkFailure()` — no server.
→ `playwright.config.ts` — cross-browser, video/screenshot/trace on failure.

**"Playwright vs Selenium"**
→ Auto-waiting (no WebDriverWait boilerplate), `page.route()` for network interception,
→ Trace viewer for debugging, first-class TypeScript support, parallel by default.
