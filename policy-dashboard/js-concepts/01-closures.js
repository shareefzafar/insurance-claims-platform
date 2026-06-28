/**
 * JAVASCRIPT CONCEPT 1: CLOSURES
 * ================================
 * A closure is a function that RETAINS ACCESS to variables from its
 * outer scope even after the outer function has returned.
 *
 * Run: node js-concepts/01-closures.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' CLOSURES');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 1: Basic closure — private counter
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Example 1: Private counter ──');

function makeCounter(start = 0) {
  let count = start; // 'count' lives in the outer function scope

  return {
    increment: () => ++count,  // closes over 'count' — still accessible
    decrement: () => --count,
    value:     () => count,
    reset:     () => { count = start; },
  };
  // makeCounter() has returned — but count is NOT garbage collected
  // because the returned object still holds references to it
}

const counter1 = makeCounter(0);
const counter2 = makeCounter(10); // independent closure — separate 'count'

counter1.increment(); // 1
counter1.increment(); // 2
counter1.increment(); // 3
counter2.increment(); // 11 — separate from counter1

console.log('counter1:', counter1.value()); // 3
console.log('counter2:', counter2.value()); // 11  ← independent
console.log('count variable is NOT accessible from outside:', typeof count); // undefined


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 2: Function factory
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 2: Function factory ──');

function multiplier(factor) {
  // 'factor' is in the closure
  return (number) => number * factor;
}

const double = multiplier(2); // factor=2 captured in closure
const triple = multiplier(3); // factor=3 captured in closure
const tenX   = multiplier(10);

console.log('double(5):', double(5)); // 10
console.log('triple(5):', triple(5)); // 15
console.log('tenX(5):',   tenX(5));   // 50

// Real-world use: bake in the JWT token once, use everywhere
function fetchWithAuth(token) {
  return (url) => {
    console.log(`  Fetching ${url} with token: ${token.slice(0, 10)}...`);
    // token is closed over — always included automatically
    return `Response from ${url}`;
  };
}

const apiFetch = fetchWithAuth('eyJhbGciOiJSUzI1NiJ9.claims-processor');
apiFetch('/api/v1/claims');   // token automatically included
apiFetch('/api/v1/policies'); // same token, zero repetition — DRY via closure


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 3: Memoisation (cache via closure)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 3: Memoisation ──');

function memoize(fn) {
  const cache = new Map(); // 'cache' lives in the closure — private to this memoized fn

  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      console.log(`  Cache HIT for key: ${key}`);
      return cache.get(key);
    }
    console.log(`  Cache MISS for key: ${key} — computing...`);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

function expensiveCalc(n) {
  // Simulate expensive operation
  return n * n * 42;
}

const memoizedCalc = memoize(expensiveCalc);
console.log(memoizedCalc(5));  // MISS — computed
console.log(memoizedCalc(5));  // HIT — from cache
console.log(memoizedCalc(10)); // MISS — computed
console.log(memoizedCalc(10)); // HIT — from cache


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 4: Classic closure trap with var (and the let fix)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 4: var trap vs let fix ──');

// WRONG: var is function-scoped — all callbacks share the SAME i
const wrongFns = [];
for (var i = 0; i < 3; i++) {
  wrongFns.push(() => i); // closes over the SAME var i
}
console.log('var (WRONG):', wrongFns.map(f => f())); // [3, 3, 3] — all see i=3

// FIX 1: let — block-scoped, each iteration gets its own i
const rightFns1 = [];
for (let j = 0; j < 3; j++) {
  rightFns1.push(() => j); // each iteration closes over its OWN j
}
console.log('let (correct):', rightFns1.map(f => f())); // [0, 1, 2]

// FIX 2: IIFE — immediately invoked function captures the value
const rightFns2 = [];
for (var k = 0; k < 3; k++) {
  rightFns2.push(((val) => () => val)(k)); // IIFE creates a new scope for each k
}
console.log('IIFE (correct):', rightFns2.map(f => f())); // [0, 1, 2]


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 5: Partial application via closure
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 5: Partial application ──');

function premiumCalculator(basePremium, riskMultiplier, age) {
  return basePremium * riskMultiplier * (1 + age / 100);
}

// Bake in base premium and risk multiplier for a specific policy type
function partiallyApply(fn, ...fixedArgs) {
  return (...remainingArgs) => fn(...fixedArgs, ...remainingArgs);
  // fixedArgs are captured in the closure
}

const homeClaimCalc    = partiallyApply(premiumCalculator, 500, 1.2);
const vehicleClaimCalc = partiallyApply(premiumCalculator, 300, 1.5);

console.log('Home premium for age 30:',    homeClaimCalc(30));    // 500*1.2*(1+0.3) = 780
console.log('Vehicle premium for age 30:', vehicleClaimCalc(30)); // 300*1.5*(1+0.3) = 585

console.log('\n✅ Closures: DONE');
