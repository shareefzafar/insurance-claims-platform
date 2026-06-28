/**
 * ClaimCard Component — Unit Tests
 * ==================================
 * Tests: rendering, accessibility, event handlers, conditional rendering.
 * Uses: @testing-library/react for component testing.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimCard } from '@/components/ClaimCard';
import type { ClaimSummary } from '@/types/policy.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────

const submittedClaim: ClaimSummary = {
  id:          'claim-001',
  policyId:    'POL-001',
  type:        'HOME',
  status:      'SUBMITTED',
  amount:      500.00,
  submittedAt: '2024-01-15T10:00:00Z',
};

const underReviewClaim: ClaimSummary = {
  ...submittedClaim,
  id:     'claim-002',
  status: 'UNDER_REVIEW',
};

const approvedClaim: ClaimSummary = {
  ...submittedClaim,
  id:     'claim-003',
  status: 'APPROVED',
};

// ─────────────────────────────────────────────────────────────────────────────
// RENDERING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard rendering', () => {

  test('displays claim type', () => {
    render(<ClaimCard claim={submittedClaim} />);
    expect(screen.getByTestId('claim-type')).toHaveTextContent('HOME');
  });

  test('displays truncated claim ID', () => {
    render(<ClaimCard claim={submittedClaim} />);
    // First 8 chars of ID, uppercased: 'CLAIM-00'.toUpperCase() = 'CLAIM-00'
    expect(screen.getByTestId('claim-id')).toHaveTextContent('CLAIM-00');
  });

  test('displays policy ID', () => {
    render(<ClaimCard claim={submittedClaim} />);
    expect(screen.getByTestId('policy-id')).toHaveTextContent('POL-001');
  });

  test('displays formatted amount in AUD currency', () => {
    render(<ClaimCard claim={submittedClaim} />);
    // Intl.NumberFormat formats 500 as 'A$500.00' or 'AU$500.00' depending on locale
    expect(screen.getByTestId('claim-amount').textContent).toMatch(/500/);
  });

  test('displays status badge with correct text', () => {
    render(<ClaimCard claim={submittedClaim} />);
    const badge = screen.getByTestId('status-badge-submitted');
    expect(badge).toHaveTextContent('Submitted');
  });

  test('displays UNDER_REVIEW badge', () => {
    render(<ClaimCard claim={underReviewClaim} />);
    expect(screen.getByTestId('status-badge-under_review')).toHaveTextContent('Under Review');
  });

  test('displays APPROVED badge', () => {
    render(<ClaimCard claim={approvedClaim} />);
    expect(screen.getByTestId('status-badge-approved')).toHaveTextContent('Approved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard interactions', () => {

  test('calls onSelect with claim ID when card is clicked', async () => {
    const onSelect = jest.fn();
    render(<ClaimCard claim={submittedClaim} onSelect={onSelect} />);

    await userEvent.click(screen.getByTestId('claim-card'));

    expect(onSelect).toHaveBeenCalledWith('claim-001');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('calls onSelect on Enter key press (accessibility)', async () => {
    const onSelect = jest.fn();
    render(<ClaimCard claim={submittedClaim} onSelect={onSelect} />);

    const card = screen.getByTestId('claim-card');
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('claim-001');
  });

  test('does not throw when onSelect is not provided', async () => {
    render(<ClaimCard claim={submittedClaim} />);
    expect(() => userEvent.click(screen.getByTestId('claim-card'))).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE / REJECT BUTTON TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard approve/reject buttons', () => {

  test('shows approve and reject buttons only for UNDER_REVIEW claims', () => {
    const onApprove = jest.fn();
    const onReject  = jest.fn();

    render(
      <ClaimCard
        claim={underReviewClaim}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(screen.getByTestId('approve-button')).toBeInTheDocument();
    expect(screen.getByTestId('reject-button')).toBeInTheDocument();
  });

  test('does NOT show action buttons for SUBMITTED claims', () => {
    render(
      <ClaimCard
        claim={submittedClaim}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
  });

  test('calls onApprove with claim ID when approve button is clicked', async () => {
    const onApprove = jest.fn();
    const onSelect  = jest.fn();

    render(
      <ClaimCard
        claim={underReviewClaim}
        onApprove={onApprove}
        onReject={jest.fn()}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByTestId('approve-button'));

    expect(onApprove).toHaveBeenCalledWith('claim-002');
    // stopPropagation: card onSelect should NOT fire
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('calls onReject with claim ID when reject button is clicked', async () => {
    const onReject = jest.fn();
    const onSelect = jest.fn();

    render(
      <ClaimCard
        claim={underReviewClaim}
        onApprove={jest.fn()}
        onReject={onReject}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByTestId('reject-button'));

    expect(onReject).toHaveBeenCalledWith('claim-002');
    expect(onSelect).not.toHaveBeenCalled(); // stopPropagation working
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCESSIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard accessibility', () => {

  test('card has role="button"', () => {
    render(<ClaimCard claim={submittedClaim} />);
    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
  });

  test('approve button has accessible label', () => {
    render(
      <ClaimCard
        claim={underReviewClaim}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /approve claim/i })).toBeInTheDocument();
  });

  test('isSelected state updates aria-selected attribute', () => {
    const { rerender } = render(<ClaimCard claim={submittedClaim} isSelected={false} />);
    expect(screen.getByTestId('claim-card')).toHaveAttribute('aria-selected', 'false');

    rerender(<ClaimCard claim={submittedClaim} isSelected={true} />);
    expect(screen.getByTestId('claim-card')).toHaveAttribute('aria-selected', 'true');
  });

  test('card has tabIndex=0 for keyboard navigation', () => {
    render(<ClaimCard claim={submittedClaim} />);
    expect(screen.getByTestId('claim-card')).toHaveAttribute('tabindex', '0');
  });
});
