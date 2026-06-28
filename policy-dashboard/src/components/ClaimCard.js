/**
 * ClaimCard — renders a single claim card.
 * Pure function: takes data, returns DOM element.
 * No framework — demonstrates vanilla JS DOM manipulation.
 */

const STATUS_CONFIG = {
  SUBMITTED:    { label: 'Submitted',    css: 'badge--blue'   },
  UNDER_REVIEW: { label: 'Under Review', css: 'badge--yellow' },
  APPROVED:     { label: 'Approved',     css: 'badge--green'  },
  REJECTED:     { label: 'Rejected',     css: 'badge--red'    },
  PAID:         { label: 'Paid',         css: 'badge--purple' },
};

const TYPE_ICON = { HOME: '🏠', HEALTH: '🏥', VEHICLE: '🚗' };

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const DATE = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' });

/**
 * Creates and returns a claim card DOM element.
 *
 * @param {object} claim - claim data object
 * @param {object} handlers - { onSelect, onApprove, onReject }
 */
export function createClaimCard(claim, { onSelect, onApprove, onReject } = {}) {
  const { label, css } = STATUS_CONFIG[claim.status] ?? { label: claim.status, css: '' };

  const card = document.createElement('article');
  card.className        = 'claim-card';
  card.dataset.testid   = 'claim-card';
  card.dataset.claimId  = claim.id;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Claim ${claim.id}, ${claim.type}, ${label}`);

  card.innerHTML = `
    <div class="claim-card__header">
      <span class="claim-card__type" data-testid="claim-type">
        ${TYPE_ICON[claim.type] ?? ''} ${claim.type}
      </span>
      <span class="badge ${css}" data-testid="status-badge">${label}</span>
    </div>
    <div class="claim-card__body">
      <div class="claim-card__id"     data-testid="claim-id">    #${claim.id.slice(0,8).toUpperCase()}</div>
      <div class="claim-card__policy" data-testid="policy-id">   Policy: ${claim.policyId}</div>
      <div class="claim-card__amount" data-testid="claim-amount">${AUD.format(claim.amount)}</div>
      <div class="claim-card__date"   data-testid="submitted-date">
        Submitted: ${DATE.format(new Date(claim.submittedAt))}
      </div>
    </div>
    ${claim.status === 'UNDER_REVIEW' ? `
      <div class="claim-card__actions">
        <button class="btn btn--approve" data-testid="approve-button"
                aria-label="Approve claim ${claim.id}">Approve</button>
        <button class="btn btn--reject"  data-testid="reject-button"
                aria-label="Reject claim ${claim.id}">Reject</button>
      </div>
    ` : ''}
  `;

  // Event listeners
  if (onSelect) {
    card.addEventListener('click', () => onSelect(claim.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(claim.id); }
    });
  }

  if (claim.status === 'UNDER_REVIEW') {
    card.querySelector('[data-testid="approve-button"]')?.addEventListener('click', e => {
      e.stopPropagation(); // don't bubble to card click
      onApprove?.(claim.id);
    });
    card.querySelector('[data-testid="reject-button"]')?.addEventListener('click', e => {
      e.stopPropagation();
      onReject?.(claim.id);
    });
  }

  return card;
}
