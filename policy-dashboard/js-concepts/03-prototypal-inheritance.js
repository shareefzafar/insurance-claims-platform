/**
 * JAVASCRIPT CONCEPT 3: PROTOTYPAL INHERITANCE
 * ==============================================
 * JavaScript uses prototype chains — not class-based copies.
 * Every object has a hidden __proto__ link to its prototype.
 * Property not found on object? Walk up the chain until null.
 * ES6 class syntax is SYNTACTIC SUGAR — same prototype chain underneath.
 *
 * Run: node js-concepts/03-prototypal-inheritance.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' PROTOTYPAL INHERITANCE');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 1: Raw prototype chain
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Example 1: Raw prototype chain ──');

const claimBase = {
  getStatus() { return this.status; },
  isOpen()    { return this.status === 'SUBMITTED' || this.status === 'UNDER_REVIEW'; },
  toString()  { return `Claim(${this.id}, ${this.status})`; },
};

const homeClaim = Object.create(claimBase); // homeClaim.__proto__ === claimBase
homeClaim.id     = 'CLM-001';
homeClaim.status = 'SUBMITTED';
homeClaim.type   = 'HOME';

console.log('homeClaim.getStatus():', homeClaim.getStatus());
// getStatus() NOT on homeClaim → walks __proto__ → found on claimBase

console.log('homeClaim.isOpen():', homeClaim.isOpen());
// Same — walks up the chain

console.log('homeClaim.type:', homeClaim.type);
// 'type' IS on homeClaim → found immediately, no chain walk

console.log('Does homeClaim have getStatus own?', homeClaim.hasOwnProperty('getStatus')); // false
console.log('Does claimBase have getStatus own?', claimBase.hasOwnProperty('getStatus')); // true

// Walk the chain manually
console.log('homeClaim.__proto__ === claimBase:', Object.getPrototypeOf(homeClaim) === claimBase);
console.log('claimBase.__proto__:', Object.getPrototypeOf(claimBase) === Object.prototype);


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 2: Constructor function (pre-ES6 pattern)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 2: Constructor function (pre-ES6) ──');

function Claim(id, policyId, amount, type) {
  // 'this' is the new object created by 'new'
  this.id       = id;
  this.policyId = policyId;
  this.amount   = amount;
  this.type     = type;
  this.status   = 'SUBMITTED';
}

// Methods on the prototype — shared by ALL instances (not copied per instance)
Claim.prototype.approve = function() {
  if (this.status !== 'UNDER_REVIEW') throw new Error(`Cannot approve from ${this.status}`);
  this.status = 'APPROVED';
  return this;
};

Claim.prototype.startReview = function() {
  if (this.status !== 'SUBMITTED') throw new Error(`Cannot review from ${this.status}`);
  this.status = 'UNDER_REVIEW';
  return this;
};

Claim.prototype.toString = function() {
  return `Claim{id=${this.id}, status=${this.status}, amount=$${this.amount}}`;
};

const claim1 = new Claim('CLM-001', 'POL-001', 500, 'HOME');
const claim2 = new Claim('CLM-002', 'POL-001', 300, 'VEHICLE');

claim1.startReview().approve();

console.log(claim1.toString()); // APPROVED
console.log(claim2.toString()); // SUBMITTED

// Methods are shared via prototype — NOT copied to each instance
console.log('Same approve function?', claim1.approve === claim2.approve); // true
// If we had put approve() inside the constructor: false (wasteful — new function per instance)


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 3: ES6 class — syntactic sugar over prototypes
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 3: ES6 class (same prototype chain underneath) ──');

class PolicyHolder {
  constructor(id, fullName, email) {
    this.id       = id;
    this.fullName = fullName;
    this.email    = email;
  }

  greet() {
    return `Hello, ${this.fullName}`;
  }

  toString() {
    return `PolicyHolder(${this.id}, ${this.fullName})`;
  }
}

class PremiumPolicyHolder extends PolicyHolder {
  constructor(id, fullName, email, tier) {
    super(id, fullName, email); // calls PolicyHolder constructor
    this.tier = tier;
  }

  // Override — own implementation takes precedence in prototype chain
  greet() {
    return `Welcome back, ${this.fullName} [${this.tier}]`;
  }

  getDiscount() {
    return this.tier === 'GOLD' ? 0.20 : 0.10;
  }
}

const holder  = new PolicyHolder('H001', 'Mohammad Zafar', 'zafar@email.com');
const premium = new PremiumPolicyHolder('H002', 'Jane Smith', 'jane@email.com', 'GOLD');

console.log(holder.greet());   // Hello, Mohammad Zafar
console.log(premium.greet());  // Welcome back, Jane Smith [GOLD] (overridden)
console.log(premium.toString()); // PolicyHolder(H002, Jane Smith) — inherited, not overridden
console.log('Discount:', premium.getDiscount()); // 0.20

// Proof it's still prototype chain
console.log('\nProving ES6 class IS prototype chain:');
console.log('typeof PolicyHolder:', typeof PolicyHolder);           // function
console.log('premium instanceof PremiumPolicyHolder:', premium instanceof PremiumPolicyHolder); // true
console.log('premium instanceof PolicyHolder:', premium instanceof PolicyHolder);               // true
console.log('PremiumPolicyHolder.prototype.__proto__ === PolicyHolder.prototype:',
  Object.getPrototypeOf(PremiumPolicyHolder.prototype) === PolicyHolder.prototype); // true


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 4: Duck typing (structural typing — no explicit interface needed)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Example 4: Duck typing ──');

// In Java: must explicitly implement NotificationStrategy interface
// In JavaScript: any object with a 'notify' method works

function notifyClaims(claims, notificationStrategy) {
  // Does not check instanceof — just calls the method (duck typing)
  claims.forEach(c => notificationStrategy.notify(c));
}

const emailStrategy = {
  notify: (claim) => console.log(`  EMAIL: Claim ${claim.id} status: ${claim.status}`),
};

const smsStrategy = {
  notify: (claim) => console.log(`  SMS: Claim ${claim.id} -> ${claim.status}`),
};

// Plain objects — no class, no inheritance, no interface
// Works because they both have notify() — duck typing
const claims = [
  { id: 'CLM-001', status: 'APPROVED' },
  { id: 'CLM-002', status: 'REJECTED' },
];

notifyClaims(claims, emailStrategy);
notifyClaims(claims, smsStrategy);

console.log('\n✅ Prototypal inheritance: DONE');
