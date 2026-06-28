/**
 * JAVASCRIPT CONCEPT 8: EVENT EMITTER (Observer Pattern)
 * ========================================================
 * Implements a full EventEmitter class in plain JavaScript.
 * Demonstrates: Map, closures, once() wrapper, snapshot-before-iterate.
 * This is how Node.js EventEmitter and browser DOM events work internally.
 *
 * Run: node js-concepts/08-event-emitter.js
 */

'use strict';

console.log('═══════════════════════════════════════');
console.log(' EVENT EMITTER — Observer Pattern');
console.log('═══════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

class EventEmitter {
  constructor() {
    // Map: eventName → [listener1, listener2, ...]
    // Map is preferred over plain object: keys can be any value, better performance
    this._listeners = new Map();
  }

  /**
   * Register a listener for an event.
   * Returns 'this' for method chaining: emitter.on('a', fn).on('b', fn2)
   */
  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError(`Listener must be a function, got ${typeof listener}`);
    }
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
    return this; // enable chaining
  }

  /**
   * Remove a specific listener.
   * Uses reference equality — only removes the exact function reference.
   */
  off(event, listener) {
    if (!this._listeners.has(event)) return this;
    const updated = this._listeners.get(event).filter(l => l !== listener);
    this._listeners.set(event, updated);
    return this;
  }

  /**
   * Emit an event — call all registered listeners with the given arguments.
   *
   * IMPORTANT: spread [...existing] before iterating.
   * If a listener calls off() or once() during emit (removing itself),
   * iterating the original array causes ConcurrentModificationException-like bugs.
   * Spreading creates a SNAPSHOT — safe to iterate even if listeners modify the list.
   */
  emit(event, ...args) {
    if (!this._listeners.has(event)) return this;
    // Snapshot before iterating — listener may remove itself (once pattern)
    const snapshot = [...this._listeners.get(event)];
    snapshot.forEach(listener => listener(...args));
    return this;
  }

  /**
   * Register a listener that fires EXACTLY ONCE, then removes itself.
   *
   * CLOSURE: wrapper closes over both 'listener' and the off() call.
   * The 'wrapper' function is what gets registered — not the original listener.
   * When wrapper fires: calls original, then this.off(event, wrapper) removes wrapper.
   */
  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);              // call the original listener
      this.off(event, wrapper);       // wrapper closes over itself — removes itself
    };
    return this.on(event, wrapper);
  }

  /** Returns the number of listeners for a given event. */
  listenerCount(event) {
    return this._listeners.get(event)?.length ?? 0;
  }

  /** Remove all listeners for all events. */
  removeAllListeners() {
    this._listeners.clear();
    return this;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO: Claims dashboard event bus
// ─────────────────────────────────────────────────────────────────────────────

const dashboardEvents = new EventEmitter();

console.log('── Demo 1: Basic on/emit ──');

dashboardEvents.on('claim:submitted', (claimId, amount) => {
  console.log(`  [AuditLog]    Claim ${claimId} submitted for $${amount}`);
});

dashboardEvents.on('claim:submitted', (claimId, amount) => {
  console.log(`  [Dashboard]   Update pending count — new claim ${claimId} for $${amount}`);
});

dashboardEvents.emit('claim:submitted', 'CLM-001', 500.00);
dashboardEvents.emit('claim:submitted', 'CLM-002', 1200.00);

console.log('\n── Demo 2: off() — remove specific listener ──');

const fraudHandler = (claimId) => {
  console.log(`  [FraudCheck]  Analysing claim ${claimId}...`);
};

dashboardEvents.on('claim:submitted', fraudHandler);
dashboardEvents.emit('claim:submitted', 'CLM-003', 50000); // fraud handler fires

dashboardEvents.off('claim:submitted', fraudHandler);
dashboardEvents.emit('claim:submitted', 'CLM-004', 100);   // fraud handler does NOT fire
console.log('  (fraud handler removed — only audit and dashboard listeners fire)');

console.log('\n── Demo 3: once() — fires exactly one time ──');

let startupCount = 0;
dashboardEvents.once('app:startup', () => {
  startupCount++;
  console.log(`  [Startup]     Application initialised (count: ${startupCount})`);
});

dashboardEvents.emit('app:startup'); // fires — handler executes and removes itself
dashboardEvents.emit('app:startup'); // nothing — handler already removed
dashboardEvents.emit('app:startup'); // nothing
console.log(`  startup handler called ${startupCount} time(s) (should be 1)`);

console.log('\n── Demo 4: Method chaining ──');

const emitter = new EventEmitter();
emitter
  .on('claim:approved', (id) => console.log(`  [Email]  Send approval for ${id}`))
  .on('claim:approved', (id) => console.log(`  [SMS]    Send approval SMS for ${id}`))
  .on('claim:rejected', (id) => console.log(`  [Email]  Send rejection for ${id}`));

emitter.emit('claim:approved', 'CLM-005');
emitter.emit('claim:rejected', 'CLM-006');

console.log('\n── Demo 5: Snapshot before iterate ──');
console.log('Listener removes itself during emit — other listeners still fire:\n');

const snapshotDemo = new EventEmitter();
const results = [];

const l1 = () => results.push('l1');
const l2 = () => {
  results.push('l2');
  snapshotDemo.off('test', l2); // removes itself during emit
};
const l3 = () => results.push('l3');

snapshotDemo.on('test', l1).on('test', l2).on('test', l3);
snapshotDemo.emit('test'); // all three fire on this emit (snapshot taken before iterating)
console.log('  First emit:', results);  // ['l1', 'l2', 'l3']

results.length = 0;
snapshotDemo.emit('test'); // l2 is now removed
console.log('  Second emit:', results); // ['l1', 'l3']

console.log('\n── Demo 6: listenerCount ──');
const countDemo = new EventEmitter();
countDemo.on('event', () => {}).on('event', () => {}).on('event', () => {});
console.log(`  Before: ${countDemo.listenerCount('event')} listeners`);
countDemo.removeAllListeners();
console.log(`  After removeAll: ${countDemo.listenerCount('event')} listeners`);

console.log('\n── Real-world: How this maps to the claims dashboard ──');
console.log('  Publisher (claimsService.js):');
console.log('    dashboardEvents.emit("claim:submitted", claimId, amount)');
console.log('  Subscribers (components):');
console.log('    dashboardEvents.on("claim:submitted", updatePendingCount)');
console.log('    dashboardEvents.on("claim:submitted", showToastNotification)');
console.log('    dashboardEvents.on("claim:submitted", logToAuditTrail)');
console.log('  → Publisher does not know who is listening (decoupled)');
console.log('  → Adding a new listener = zero changes to claimsService.js (OCP)');

console.log('\n✅ EventEmitter (Observer Pattern): DONE');
