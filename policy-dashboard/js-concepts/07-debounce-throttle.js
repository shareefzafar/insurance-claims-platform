/**
 * JAVASCRIPT CONCEPT 7: DEBOUNCE & THROTTLE FROM SCRATCH
 * ========================================================
 * Both are rate-limiting patterns using closures + timers.
 *
 * DEBOUNCE: fires AFTER a quiet period — waits for user to stop
 *           Use: search input, window resize handler
 *
 * THROTTLE: fires AT MOST once per interval — controls rate
 *           Use: scroll events, mouse move, API polling
 *
 * Run: node js-concepts/07-debounce-throttle.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' DEBOUNCE & THROTTLE FROM SCRATCH');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION: debounce
// ─────────────────────────────────────────────────────────────────────────────

function debounce(fn, wait) {
  let timerId = null;
  // 'timerId' is in the CLOSURE — persists between calls to the returned function
  // Without closure: timerId would reset to null on every call — debounce impossible

  return function(...args) {
    // Cancel the previously scheduled call — user is still acting
    clearTimeout(timerId);

    // Schedule a new call after 'wait' ms of silence
    timerId = setTimeout(() => {
      fn.apply(this, args); // apply() preserves 'this' context and all args
      timerId = null;
    }, wait);
  };
}

// Cancellable version — useful for component unmount cleanup
function debounceCancellable(fn, wait) {
  let timerId = null;

  function execute(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, wait);
  }

  function cancel() {
    clearTimeout(timerId);
    timerId = null;
  }

  return { execute, cancel };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION: throttle
// ─────────────────────────────────────────────────────────────────────────────

function throttle(fn, limit) {
  let lastCall = 0;
  // 'lastCall' persists via closure — tracks when we last fired

  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn.apply(this, args);
    }
    // If within limit window: silently ignored
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO: Debounce behaviour
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Debounce Demo: Search input ──');
console.log('Simulating rapid keystrokes: P-O-L-I-C-Y (6 chars in 300ms)\n');

let searchCallCount = 0;
const searchAPI = (query) => {
  searchCallCount++;
  console.log(`  API called with: "${query}" (call #${searchCallCount})`);
};

const debouncedSearch = debounce(searchAPI, 200);

// Simulate rapid keystrokes
const keystrokes = ['P', 'PO', 'POL', 'POLI', 'POLIC', 'POLICY'];
let delay = 0;
keystrokes.forEach((query, i) => {
  delay += 50; // 50ms between keystrokes
  setTimeout(() => {
    process.stdout.write(`  Keystroke: "${query}" `);
    debouncedSearch(query);
    if (i < keystrokes.length - 1) {
      console.log('→ cancelled (next keystroke within 200ms)');
    } else {
      console.log('→ scheduled (no more keystrokes)');
    }
  }, delay);
});

setTimeout(() => {
  console.log(`\nTotal API calls: ${searchCallCount} (should be 1, not 6)`);
  console.log('Only the LAST keystroke fires after 200ms of silence');
}, delay + 300);


// ─────────────────────────────────────────────────────────────────────────────
// DEMO: Throttle behaviour
// ─────────────────────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log('\n── Throttle Demo: Scroll handler ──');
  console.log('Simulating 10 scroll events in 500ms (throttled to max 1 per 200ms)\n');

  let scrollCallCount = 0;
  const onScroll = (position) => {
    scrollCallCount++;
    console.log(`  Scroll handler fired: position=${position} (call #${scrollCallCount})`);
  };

  const throttledScroll = throttle(onScroll, 200);

  // Simulate rapid scroll events every 50ms
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      throttledScroll(i * 100); // scroll position
    }, i * 50); // every 50ms
  }

  setTimeout(() => {
    console.log(`\nTotal scroll handler calls: ${scrollCallCount} (should be 2-3, not 10)`);
    console.log('Throttle fires immediately, then at most once per 200ms interval');
  }, 600);
}, 800);


// ─────────────────────────────────────────────────────────────────────────────
// DEMO: Debounce vs Throttle comparison
// ─────────────────────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log('\n── Comparison: Debounce vs Throttle with same input ──');

  const debounceCalls  = [];
  const throttleCalls  = [];

  const dFn = debounce(() => debounceCalls.push(Date.now()), 200);
  const tFn = throttle(() => throttleCalls.push(Date.now()), 200);

  const startTime = Date.now();
  // Fire 5 rapid events
  for (let i = 0; i < 5; i++) {
    setTimeout(() => { dFn(); tFn(); }, i * 60);
  }

  setTimeout(() => {
    console.log(`Debounce fired: ${debounceCalls.length} time(s)`);   // 1 (after quiet period)
    console.log(`Throttle fired: ${throttleCalls.length} time(s)`);   // ~1-2 (rate limited)
    console.log('\nWhen to use which:');
    console.log('  Debounce: search input, form validation, resize — wait for user to stop');
    console.log('  Throttle: scroll, mouse move, API polling — control the firing rate');
    console.log('\n✅ Debounce & Throttle: DONE');
  }, 600);
}, 1800);
