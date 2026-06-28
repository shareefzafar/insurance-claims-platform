/**
 * JAVASCRIPT CONCEPT 5: 'this' BINDING
 * ======================================
 * 'this' is determined at CALL TIME, not definition time (except arrow functions).
 *
 * FOUR RULES (in priority order):
 *  1. new binding:      new MyClass()     → 'this' is the new object
 *  2. Explicit binding: fn.call(obj)      → 'this' is obj
 *  3. Implicit binding: obj.method()      → 'this' is obj
 *  4. Default binding:  fn()              → 'this' is undefined (strict) or global
 *
 * ARROW FUNCTIONS: no own 'this' — inherits from enclosing lexical scope at DEFINITION time
 *
 * Run: node js-concepts/05-this-binding.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(" 'this' BINDING");
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1: new binding
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Rule 1: new binding ──');

function ClaimService(repository) {
  this.repository = repository;  // 'this' is the newly created object
  this.claims     = [];
}

ClaimService.prototype.add = function(claim) {
  this.claims.push(claim);       // 'this' is the ClaimService instance
};

const service = new ClaimService({ find: () => {} });
service.add({ id: 'CLM-001' });
console.log('new binding: this.claims.length =', service.claims.length); // 1


// ─────────────────────────────────────────────────────────────────────────────
// RULE 2: Explicit binding — call(), apply(), bind()
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Rule 2: Explicit binding (call, apply, bind) ──');

function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

const user1 = { name: 'Mohammad' };
const user2 = { name: 'Jane' };

// call(): explicit 'this' + individual args
console.log(greet.call(user1, 'Hello', '!'));   // Hello, Mohammad!
console.log(greet.call(user2, 'Hi', '.'));      // Hi, Jane.

// apply(): explicit 'this' + args as ARRAY
console.log(greet.apply(user1, ['Welcome', '~'])); // Welcome, Mohammad~

// bind(): returns a NEW function with 'this' permanently bound (does not call it)
const greetMohammad = greet.bind(user1, 'Dear');
console.log(greetMohammad('...'));  // Dear, Mohammad...
console.log(greetMohammad('!!!'));  // Dear, Mohammad!!!
// Same bound function, different second argument

// Mnemonic: call = Comma-separated, Apply = Array, Bind = borrow for later


// ─────────────────────────────────────────────────────────────────────────────
// RULE 3: Implicit binding
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Rule 3: Implicit binding ──');

const claimProcessor = {
  name: 'HomeProcessor',
  process(claim) {
    // 'this' is claimProcessor because we call claimProcessor.process()
    return `${this.name} processed claim ${claim.id}`;
  },
};

console.log(claimProcessor.process({ id: 'CLM-001' }));
// HomeProcessor processed claim CLM-001

// LOST implicit binding — detaching the method loses 'this'
const processDetached = claimProcessor.process;
try {
  processDetached({ id: 'CLM-001' }); // 'this' is undefined in strict mode
} catch (e) {
  console.log('Lost implicit binding:', e.message); // Cannot read property 'name' of undefined
}


// ─────────────────────────────────────────────────────────────────────────────
// RULE 4: Default binding (and the common callback trap)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── Rule 4: Default binding + callback trap ──');

class PolicyService {
  constructor() {
    this.policies = [];
    this.name     = 'PolicyService';
  }

  // BROKEN: 'this' is lost when passed as callback
  loadBroken() {
    const fetchData = function(callback) {
      callback(['POL-001', 'POL-002']); // callback called without obj context
    };
    fetchData(function(data) {
      try {
        this.policies = data; // 'this' is undefined in strict mode → TypeError
        console.log('Loaded:', this.policies);
      } catch (e) {
        console.log('Broken callback this:', e.message);
      }
    });
  }

  // FIX 1: Arrow function — inherits 'this' from enclosing scope at DEFINITION time
  loadFixed() {
    const fetchData = function(callback) { callback(['POL-001', 'POL-002']); };
    fetchData((data) => {
      this.policies = data; // 'this' = PolicyService instance — arrow captured it
      console.log('Arrow fix: loaded', this.policies.length, 'policies');
    });
  }

  // FIX 2: bind() — permanently bind 'this' to the callback
  loadWithBind() {
    const fetchData = function(callback) { callback(['POL-001', 'POL-002']); };
    const onData = function(data) {
      this.policies = data;
      console.log('bind() fix: loaded', this.policies.length, 'policies');
    };
    fetchData(onData.bind(this)); // bind 'this' before passing as callback
  }

  // FIX 3: async/await — no callback, 'this' is always clear
  async loadAsync() {
    const data = await Promise.resolve(['POL-001', 'POL-002']);
    this.policies = data; // 'this' = PolicyService — no callback involved
    console.log('async/await fix: loaded', this.policies.length, 'policies');
  }
}

const ps = new PolicyService();
ps.loadBroken();
ps.loadFixed();
ps.loadWithBind();
ps.loadAsync().then(() => {
  console.log('\n── Summary: 4 rules in priority order ──');
  console.log('1. new MyClass()            → this = new object');
  console.log('2. fn.call(obj)/fn.bind(obj) → this = obj');
  console.log('3. obj.method()             → this = obj');
  console.log('4. fn()                     → this = undefined (strict)');
  console.log('Arrow fn:                   → this = enclosing lexical scope');
  console.log('\n✅ this binding: DONE');
});
