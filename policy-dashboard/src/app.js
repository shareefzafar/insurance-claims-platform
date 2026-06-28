/**
 * Policy Dashboard — Application Entry Point
 * Uses ES modules (type="module" in HTML) — no build step required.
 * Open src/index.html directly in a browser with a local server.
 */

import { createDashboard }  from './components/ClaimsDashboard.js';
import { dashboardEvents }  from './utils/eventEmitter.js';

// Mount the dashboard
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

const dashboard = createDashboard(root);

// Global event listeners — cross-cutting concerns
dashboardEvents.on('claim:approved', (claimId) => {
  console.log(`[App] Claim ${claimId} approved — audit trail updated`);
});

dashboardEvents.on('error:occurred', (message, code) => {
  console.error(`[App] Error ${code}: ${message}`);
});

// Export for debugging in browser console
window.__dashboard = dashboard;
window.__events    = dashboardEvents;
