/**
 * TYPESCRIPT TYPE SYSTEM DEMONSTRATION
 * =====================================
 * Shows: strict mode, discriminated unions, generics, utility types,
 *        type narrowing, exhaustiveness checking, structural typing.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LITERAL TYPES — more specific than string, caught at compile time
// ─────────────────────────────────────────────────────────────────────────────

export type PolicyStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
export type ClaimStatus  = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
export type ClaimType    = 'HOME' | 'HEALTH' | 'VEHICLE';
export type SortOrder    = 'asc' | 'desc';
export type SortField    = 'submittedAt' | 'amount' | 'status' | 'policyId';

// ─────────────────────────────────────────────────────────────────────────────
// CORE DOMAIN TYPES — structural typing (no explicit interface implementation needed)
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicyHolder {
  readonly id:          string;
  readonly fullName:    string;
  readonly email:       string;
  readonly phoneNumber: string;
  readonly nric:        string;
  readonly dateOfBirth: string; // ISO date string
}

export interface Policy {
  readonly id:          string;
  readonly holderId:    string;
  readonly holderName:  string;
  readonly status:      PolicyStatus;
  readonly premium:     number;
  readonly startDate:   string;
  readonly endDate:     string;
}

export interface Claim {
  readonly id:           string;
  readonly policyId:     string;
  readonly type:         ClaimType;
  readonly status:       ClaimStatus;
  readonly amount:       number;
  readonly description:  string;
  readonly holderName:   string;
  readonly holderEmail:  string;
  readonly submittedAt:  string;
  readonly lastUpdatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCRIMINATED UNION — ClaimEvent state machine
// TypeScript narrows the type in each switch case.
// Adding a new event type -> compile error at every unhandled switch.
// ─────────────────────────────────────────────────────────────────────────────

export type ClaimEvent =
  | { readonly type: 'SUBMITTED';    readonly claimId: string; readonly amount: number;   readonly submittedAt: string }
  | { readonly type: 'UNDER_REVIEW'; readonly claimId: string; readonly reviewedBy: string; readonly startedAt: string }
  | { readonly type: 'APPROVED';     readonly claimId: string; readonly approvedBy: string; readonly payout: number; readonly approvedAt: string }
  | { readonly type: 'REJECTED';     readonly claimId: string; readonly rejectedBy: string; readonly reason: string;  readonly rejectedAt: string }
  | { readonly type: 'PAID';         readonly claimId: string; readonly paidAt: string;   readonly transactionId: string };

/**
 * Exhaustiveness check — compile error if a ClaimEvent type is unhandled.
 * Add a new union member and forget to handle it: TypeScript tells you here.
 */
export function getClaimEventSummary(event: ClaimEvent): string {
  switch (event.type) {
    case 'SUBMITTED':
      return `Claim ${event.claimId} submitted for $${event.amount.toFixed(2)}`;
    case 'UNDER_REVIEW':
      // TypeScript knows: event.reviewedBy exists. event.amount does NOT.
      return `Claim ${event.claimId} under review by ${event.reviewedBy}`;
    case 'APPROVED':
      return `Claim ${event.claimId} approved. Payout: $${event.payout.toFixed(2)} by ${event.approvedBy}`;
    case 'REJECTED':
      return `Claim ${event.claimId} rejected by ${event.rejectedBy}: ${event.reason}`;
    case 'PAID':
      return `Claim ${event.claimId} paid. Transaction: ${event.transactionId}`;
    default:
      // If this line errors: you added a new ClaimEvent type and forgot to handle it
      const _exhaustive: never = event;
      throw new Error(`Unhandled claim event: ${JSON.stringify(_exhaustive)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC TYPES — reusable across all API responses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic API response wrapper — type flows through.
 * ApiResponse<Policy> → data is typed as Policy, not unknown.
 */
export interface ApiResponse<T> {
  readonly data:    T;
  readonly status:  number;
  readonly message: string;
}

/**
 * Generic paginated response — works for Policy, Claim, or any entity.
 */
export interface Page<T> {
  readonly content:       T[];
  readonly totalElements: number;
  readonly totalPages:    number;
  readonly page:          number;
  readonly size:          number;
}

/**
 * Result type — caller must handle both success and failure.
 * Discriminated union forces exhaustive handling — no silent swallowing.
 */
export type Result<T, E = string> =
  | { readonly success: true;  readonly data: E extends never ? T : T }
  | { readonly success: false; readonly error: E };

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY TYPES — TypeScript built-ins demonstrated
// ─────────────────────────────────────────────────────────────────────────────

/** CreateClaimRequest — all fields required except optional ones */
export interface CreateClaimRequest {
  policyId:    string;
  type:        ClaimType;
  amount:      number;
  description: string;
  supportingDocumentUrl?: string; // optional
}

/**
 * Partial<CreateClaimRequest> — all fields optional (for PATCH / form state)
 * Pick<Claim, 'id' | 'status' | 'amount'> — subset for list view
 * Omit<Claim, 'holderEmail'> — exclude sensitive field from logs
 * Record<ClaimStatus, number> — count per status for dashboard metrics
 */
export type ClaimFormState    = Partial<CreateClaimRequest>;
export type ClaimSummary      = Pick<Claim, 'id' | 'policyId' | 'type' | 'status' | 'amount' | 'submittedAt'>;
export type ClaimPublicView   = Omit<Claim, 'holderEmail'>;
export type ClaimStatusCounts = Record<ClaimStatus, number>;

// ─────────────────────────────────────────────────────────────────────────────
// FILTER / SORT STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaimFilters {
  status?:   ClaimStatus;
  type?:     ClaimType;
  policyId?: string;
  dateFrom?: string;
  dateTo?:   string;
  minAmount?: number;
  maxAmount?: number;
}

export interface SortState {
  field: SortField;
  order: SortOrder;
}

export interface PaginationState {
  page: number;
  size: number;
}
