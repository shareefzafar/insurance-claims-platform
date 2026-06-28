/**
 * JAVASCRIPT CONCEPT 6: Promise.all FROM SCRATCH
 * ================================================
 * Implements Promise.all, Promise.allSettled, Promise.race from scratch
 * to demonstrate how Promises work internally.
 *
 * Run: node js-concepts/06-promise-all.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' Promise.all FROM SCRATCH');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION: myPromiseAll
// ─────────────────────────────────────────────────────────────────────────────

function myPromiseAll(promises) {
  return new Promise((resolve, reject) => {
    // Edge case: empty array resolves immediately with []
    if (promises.length === 0) {
      resolve([]);
      return;
    }

    const results      = new Array(promises.length);
    let resolvedCount  = 0;

    promises.forEach((promise, index) => {
      // Promise.resolve() handles both promise and non-promise values
      // Promise.resolve(42) → a promise that resolves with 42 immediately
      Promise.resolve(promise)
        .then(value => {
          results[index] = value; // preserve ORDER — not insertion order
          resolvedCount++;
          if (resolvedCount === promises.length) {
            resolve(results); // all done — resolve with the array
          }
        })
        .catch(error => {
          reject(error); // fail-fast — first rejection rejects everything
          // Subsequent resolutions/rejections are ignored
          // (a Promise can only settle once)
        });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION: myPromiseAllSettled
// ─────────────────────────────────────────────────────────────────────────────

function myPromiseAllSettled(promises) {
  // Wrap each promise so it always resolves (never rejects)
  const wrapped = promises.map(p =>
    Promise.resolve(p)
      .then(value  => ({ status: 'fulfilled', value }))
      .catch(reason => ({ status: 'rejected',  reason }))
  );
  return myPromiseAll(wrapped);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION: myPromiseRace
// ─────────────────────────────────────────────────────────────────────────────

function myPromiseRace(promises) {
  return new Promise((resolve, reject) => {
    promises.forEach(p => {
      Promise.resolve(p).then(resolve).catch(reject);
      // First to call resolve/reject wins — subsequent calls are ignored
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {

  console.log('── Test 1: myPromiseAll with all resolving ──');
  const r1 = await myPromiseAll([
    Promise.resolve('policy'),
    Promise.resolve('claims'),
    42,            // non-promise value — Promise.resolve(42) handles it
    'static value',
  ]);
  console.log('Result:', r1); // ['policy', 'claims', 42, 'static value']

  console.log('\n── Test 2: myPromiseAll preserves ORDER regardless of resolution order ──');
  const slow  = new Promise(r => setTimeout(() => r('slow (200ms)'), 200));
  const fast  = new Promise(r => setTimeout(() => r('fast (50ms)'),   50));
  const r2    = await myPromiseAll([slow, fast]);
  console.log('Result:', r2); // ['slow (200ms)', 'fast (50ms)'] — order preserved!
  // fast resolved first, but appears at index 1 (its position in the input)

  console.log('\n── Test 3: myPromiseAll fail-fast ──');
  try {
    await myPromiseAll([
      Promise.resolve('ok'),
      Promise.reject(new Error('first failure')),
      Promise.resolve('also ok'),
    ]);
  } catch (e) {
    console.log('Caught:', e.message); // 'first failure'
    console.log('The other promises are ignored after first rejection');
  }

  console.log('\n── Test 4: myPromiseAll with empty array ──');
  const r4 = await myPromiseAll([]);
  console.log('Empty array result:', r4); // []

  console.log('\n── Test 5: myPromiseAllSettled — never rejects ──');
  const r5 = await myPromiseAllSettled([
    Promise.resolve('success'),
    Promise.reject(new Error('failure')),
    Promise.resolve('also success'),
  ]);
  r5.forEach((result, i) => {
    if (result.status === 'fulfilled') console.log(`  [${i}] fulfilled:`, result.value);
    else                               console.log(`  [${i}] rejected: `, result.reason.message);
  });

  console.log('\n── Test 6: myPromiseRace — first to settle wins ──');
  const r6 = await myPromiseRace([
    new Promise(r => setTimeout(() => r('slow: 200ms'),   200)),
    new Promise(r => setTimeout(() => r('medium: 100ms'), 100)),
    new Promise(r => setTimeout(() => r('fast: 50ms'),     50)),
  ]);
  console.log('Race winner:', r6); // 'fast: 50ms'

  console.log('\n── Test 7: Timeout pattern using Promise.race ──');
  function withTimeout(promise, ms) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
  }

  try {
    await withTimeout(
      new Promise(r => setTimeout(r, 500)), // takes 500ms
      100                                   // timeout at 100ms
    );
  } catch (e) {
    console.log('Timeout caught:', e.message);
  }

  console.log('\n── Test 8: Real-world — fetch policy and claims in parallel ──');

  // Simulate API calls
  const fetchPolicy = (id) => new Promise(r =>
    setTimeout(() => r({ id, status: 'ACTIVE', premium: 500 }), 80)
  );
  const fetchClaims = (policyId) => new Promise(r =>
    setTimeout(() => r([{ id: 'CLM-001', policyId, amount: 300 }]), 60)
  );

  const start = Date.now();
  const [policy, claims] = await myPromiseAll([
    fetchPolicy('POL-001'),
    fetchClaims('POL-001'),
  ]);
  console.log(`Fetched in ${Date.now() - start}ms (should be ~80ms, not ~140ms)`);
  console.log('Policy:', policy.id, 'Claims:', claims.length);

  console.log('\n✅ Promise.all from scratch: DONE');
}

runTests().catch(console.error);
