/**
 * JAVASCRIPT CONCEPT 2: EVENT LOOP
 * ==================================
 * JavaScript is single-threaded. The event loop enables concurrency
 * by offloading I/O and processing callbacks when the call stack is clear.
 *
 * EXECUTION ORDER:
 *  1. Synchronous code (call stack)
 *  2. Microtask queue (Promise callbacks, queueMicrotask)
 *  3. Macrotask queue (setTimeout, setInterval, I/O)
 *
 * Run: node js-concepts/02-event-loop.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' EVENT LOOP');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 1: Execution order
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Example 1: Execution order ──');
console.log('Expected output: 1, 3, 2, 4\n');

console.log('1 — sync (call stack)');

setTimeout(() => console.log('4 — macrotask (setTimeout 0ms)'), 0);
// Even 0ms: goes to MACROTASK queue — runs AFTER all microtasks

Promise.resolve().then(() => console.log('2 — microtask (Promise.then)'));
// Promise callbacks go to MICROTASK queue — higher priority than macrotask

console.log('3 — sync (call stack)');

// RULE: synchronous → microtasks → macrotasks


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 2: Sequential await vs Promise.all (after a brief delay)
// ─────────────────────────────────────────────────────────────────────────────

setTimeout(async () => {
  console.log('\n── Example 2: Sequential vs Parallel async ──');

  // Simulate API calls with different response times
  const fetchPolicy = () => new Promise(resolve =>
    setTimeout(() => resolve({ id: 'POL-001', status: 'ACTIVE' }), 100)
  );
  const fetchClaims = () => new Promise(resolve =>
    setTimeout(() => resolve([{ id: 'CLM-001', amount: 500 }]), 80)
  );

  // SEQUENTIAL — total time ≈ 100ms + 80ms = 180ms
  const seqStart = Date.now();
  const policy1  = await fetchPolicy();
  const claims1  = await fetchClaims();
  const seqTime  = Date.now() - seqStart;
  console.log(`Sequential: ${seqTime}ms (policy: ${policy1.id}, claims: ${claims1.length})`);

  // PARALLEL — total time ≈ max(100ms, 80ms) = 100ms
  const parStart           = Date.now();
  const [policy2, claims2] = await Promise.all([fetchPolicy(), fetchClaims()]);
  const parTime            = Date.now() - parStart;
  console.log(`Parallel:   ${parTime}ms (policy: ${policy2.id}, claims: ${claims2.length})`);
  console.log(`Speedup:    ~${Math.round(seqTime / parTime)}x faster with Promise.all`);
}, 10);


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 3: Promise combinators
// ─────────────────────────────────────────────────────────────────────────────

setTimeout(async () => {
  console.log('\n── Example 3: Promise combinators ──');

  const fast    = new Promise(r => setTimeout(() => r('fast: 50ms'),  50));
  const medium  = new Promise(r => setTimeout(() => r('medium: 100ms'), 100));
  const failing = new Promise((_, r) => setTimeout(() => r(new Error('failed: 75ms')), 75));

  // Promise.all — fail-fast: one reject = all reject
  try {
    await Promise.all([fast, failing, medium]);
  } catch (e) {
    console.log('Promise.all:        REJECTED immediately on first failure:', e.message);
  }

  // Promise.allSettled — all settle, gives status for each
  const results = await Promise.allSettled([fast, failing, medium]);
  results.forEach(r => {
    if (r.status === 'fulfilled') console.log('  allSettled fulfilled:', r.value);
    else                          console.log('  allSettled rejected: ', r.reason.message);
  });

  // Promise.race — first to settle wins
  const raceWinner = await Promise.race([fast, medium]);
  console.log('Promise.race winner:', raceWinner);

  // Promise.any — first SUCCESS wins (ignores rejections)
  const anyWinner = await Promise.any([failing, fast, medium]);
  console.log('Promise.any winner: ', anyWinner);
}, 20);


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 4: Microtask starvation (edge case)
// ─────────────────────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log('\n── Example 4: Microtask queue drains COMPLETELY before next macrotask ──');

  setTimeout(() => console.log('  macrotask: setTimeout fires AFTER all microtasks'), 0);

  // Queue multiple microtasks — ALL drain before setTimeout fires
  Promise.resolve()
    .then(() => console.log('  microtask 1'))
    .then(() => console.log('  microtask 2'))
    .then(() => console.log('  microtask 3'));

  console.log('  sync code runs first');
  // Output order: sync, microtask 1, 2, 3, macrotask
}, 400);

console.log('\n✅ Event loop demo running... (results appear after async operations complete)');
