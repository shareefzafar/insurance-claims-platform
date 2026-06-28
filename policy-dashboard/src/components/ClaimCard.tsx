/**
 * ClaimCard Component
 * ====================
 * Demonstrates: React functional components, TypeScript props,
 *               discriminated union narrowing in JSX, event handlers.
 */

import React from 'react';
import type { ClaimSummary, ClaimStatus, ClaimType } from '@/types/policy.types';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE — discriminated union narrowing in JSX
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string }> = {
  SUBMITTED:    { label: 'Submitted',    className: 'badge-blue'   },
  UNDER_REVIEW: { label: 'Under Review', className: 'badge-yellow' },
  APPROVED:     { label: 'Approved',     className: 'badge-green'  },
  REJECTED:     { label: 'Rejected',     className: 'badge-red'    },
  PAID:         { label: 'Paid',         className: 'badge-purple' },
};

interface StatusBadgeProps {
  status: ClaimStatus;
}

function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  // TypeScript knows STATUS_CONFIG[status] always exists — ClaimStatus is exhaustive
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`badge ${className}`}
      data-testid={`status-badge-${status.toLowerCase()}`}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM TYPE ICON
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<ClaimType, string> = {
  HOME:    '🏠',
  HEALTH:  '🏥',
  VEHICLE: '🚗',
};

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaimCardProps {
  claim:       ClaimSummary;
  onSelect?:   (claimId: string) => void;
  onApprove?:  (claimId: string) => void;
  onReject?:   (claimId: string) => void;
  isSelected?: boolean;
}

export function ClaimCard({
  claim,
  onSelect,
  onApprove,
  onReject,
  isSelected = false,
}: ClaimCardProps): React.ReactElement {
  const formattedAmount = new Intl.NumberFormat('en-AU', {
    style:    'currency',
    currency: 'AUD',
  }).format(claim.amount);

  const formattedDate = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
  }).format(new Date(claim.submittedAt));

  return (
    <div
      className={`claim-card ${isSelected ? 'claim-card--selected' : ''}`}
      onClick={() => onSelect?.(claim.id)}
      data-testid="claim-card"
      data-claim-id={claim.id}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(claim.id);
      }}
      aria-selected={isSelected}
    >
      <div className="claim-card__header">
        <span
          className="claim-card__type"
          data-testid="claim-type"
          aria-label={`Claim type: ${claim.type}`}
        >
          {TYPE_ICON[claim.type]} {claim.type}
        </span>
        <StatusBadge status={claim.status} />
      </div>

      <div className="claim-card__body">
        <div className="claim-card__id" data-testid="claim-id">
          #{claim.id.slice(0, 8).toUpperCase()}
        </div>
        <div className="claim-card__policy" data-testid="policy-id">
          Policy: {claim.policyId}
        </div>
        <div className="claim-card__amount" data-testid="claim-amount">
          {formattedAmount}
        </div>
        <div className="claim-card__date" data-testid="submitted-date">
          Submitted: {formattedDate}
        </div>
      </div>

      {/* Action buttons — only shown for UNDER_REVIEW claims */}
      {claim.status === 'UNDER_REVIEW' && (onApprove ?? onReject) && (
        <div className="claim-card__actions">
          {onApprove && (
            <button
              className="btn btn--approve"
              data-testid="approve-button"
              onClick={(e) => {
                e.stopPropagation(); // prevent card click
                onApprove(claim.id);
              }}
              aria-label={`Approve claim ${claim.id}`}
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              className="btn btn--reject"
              data-testid="reject-button"
              onClick={(e) => {
                e.stopPropagation();
                onReject(claim.id);
              }}
              aria-label={`Reject claim ${claim.id}`}
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
