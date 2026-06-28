/**
 * JAVASCRIPT CONCEPT 4: var, let, const — Hoisting & Scoping
 * ============================================================
 * var:   function-scoped, hoisted with value undefined
 * let:   block-scoped, Temporal Dead Zone before declaration
 * const: block-scoped, binding cannot be reassigned (not deeply immutable)
 *
 * Run: node js-concepts/04-var-let-const.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' var, let, const — Hoisting & Scoping');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 1: var hoisting
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Example 1: var hoisting ──');

// JavaScript secretly transforms this:
//   console.log(policyId);
//   var policyId = 'POL-001';
//
// Into this:
//   var policyId;            ← hoisted to top of function/file
//   console.log(policyId);  ← undefined (not a ReferenceError)
//   policyId = 'POL-001';

console.log('Before var declaration:', typeof claimId); // 'undefined' — hoisted
var claimId = 'CLM-001';
console.log('After var declaration:', claimId); // 'CLM-001'


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 2: let — Temporal Dead Zone
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 2: let — Temporal Dead Zone ──');

// Accessing 'let' before declaration = ReferenceError (Temporal Dead Zone)
// Uncomment to see: console.log(amount); // ReferenceError
let amount = 500;
console.log('let amount:', amount); // 500

// let is block-scoped
{
  let blockVar = 'only inside this block';
  console.log('Inside block:', blockVar);
}
// console.log(blockVar); // ReferenceError — blockVar not accessible here
console.log('blockVar outside block:', typeof blockVar); // 'undefined'


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 3: const — immutable binding, mutable value
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 3: const ──');

const config = { maxAmount: 1000000, channel: 'email', retries: 3 };

// Mutating properties: OK — the binding (reference) does not change
config.maxAmount = 500000;
config.channel   = 'sms';
console.log('config after property mutation:', config);

// Reassigning the binding: TypeError
// config = {}; // TypeError: Assignment to constant variable

// For truly immutable object: Object.freeze()
const frozenConfig = Object.freeze({ maxAmount: 1000000, channel: 'email' });
frozenConfig.maxAmount = 999; // silently ignored in strict mode
console.log('frozenConfig.maxAmount (unchanged):', frozenConfig.maxAmount); // 1000000


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 4: THE var LOOP BUG — the most famous closure + scoping pitfall
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 4: THE var loop bug ──');

// WRONG: All callbacks close over the SAME var i
const wrongCallbacks = [];
for (var i = 0; i < 3; i++) {
  wrongCallbacks.push(function() { return i; });
}
// By the time callbacks run, the loop is done and i = 3
console.log('var loop (WRONG):', wrongCallbacks.map(fn => fn())); // [3, 3, 3]

// FIX: let gives each iteration its own block-scoped j
const rightCallbacks = [];
for (let j = 0; j < 3; j++) {
  rightCallbacks.push(function() { return j; }); // each j is independent
}
console.log('let loop (correct):', rightCallbacks.map(fn => fn())); // [0, 1, 2]

// Same bug appears with setTimeout
console.log('\nvar with setTimeout (WRONG — all print 3):');
for (var n = 0; n < 3; n++) {
  setTimeout(() => process.stdout.write(n + ' '), 10); // 3 3 3
}

setTimeout(() => {
  console.log('');
  console.log('let with setTimeout (correct — prints 0 1 2):');
  for (let m = 0; m < 3; m++) {
    setTimeout(() => process.stdout.write(m + ' '), 10); // 0 1 2
  }
}, 50);


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 5: Function scope vs block scope
// ─────────────────────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log('\n\n── Example 5: Function scope vs block scope ──');

  function processClaim(claim) {
    var processed = false; // function-scoped — visible throughout processStatus

    if (claim.status === 'SUBMITTED') {
      var innerVar = 'visible outside if block!'; // var leaks out of if block
      let innerLet = 'only inside if block';
      processed = true;
    }

    console.log('var leaked outside if:', innerVar);    // 'visible outside if block!'
    // console.log(innerLet); // ReferenceError — let stays in its block
    console.log('processed:', processed);
  }

  processClaim({ status: 'SUBMITTED' });

  console.log('\n── Modern rule ──');
  console.log('const by default → let when reassignment needed → never var');
  console.log('\n✅ var/let/const: DONE');
}, 100);
