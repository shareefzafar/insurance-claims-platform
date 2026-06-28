/**
 * JAVASCRIPT CORE CONCEPT: EventEmitter
 * =======================================
 * Demonstrates: Map, closures, generic TypeScript types,
 *               Observer pattern, once() wrapper.
 *
 * Generic EventMap allows type-safe events:
 *   emitter.on('claim:approved', (id, amount) => ...)
 *   emitter.emit('claim:approved', 'C001', 500)
 *   TypeScript knows the argument types from EventMap.
 */

// EventMap: maps event names to their argument tuple types
// Usage:    EventEmitter<{ 'claim:approved': [id: string, amount: number] }>
type EventMap = Record<string, unknown[]>;

export class TypedEventEmitter<TEvents extends EventMap> {
  // Map: eventName -> array of listener functions
  // Typed so TypeScript knows what arguments each listener receives
  private readonly listeners = new Map<
    keyof TEvents,
    Array<(...args: unknown[]) => void>
  >();

  /**
   * Register a listener for an event.
   * Returns 'this' — enables chaining: emitter.on('a', fn).on('b', fn2)
   *
   * CLOSURE: the returned 'this' gives the caller a reference to the emitter
   * so they can chain .on() calls without re-referencing the variable.
   */
  on<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener as (...args: unknown[]) => void]);
    return this;
  }

  /**
   * Remove a specific listener.
   * Filters the array — only removes the exact function reference.
   * Other listeners for the same event are untouched.
   */
  off<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    const existing = this.listeners.get(event);
    if (!existing) return this;
    this.listeners.set(
      event,
      existing.filter(l => l !== (listener as (...args: unknown[]) => void))
    );
    return this;
  }

  /**
   * Emit an event — calls all registered listeners with the given arguments.
   *
   * IMPORTANT: spread [...existing] before iterating.
   * If a listener calls off() on itself during emit (e.g. once()),
   * iterating the original array would cause issues.
   * Spreading creates a snapshot — safe to iterate even if listeners modify the list.
   */
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): this {
    const existing = this.listeners.get(event);
    if (!existing) return this;
    // Snapshot before iterating — listener may remove itself (once() pattern)
    [...existing].forEach(listener => listener(...args));
    return this;
  }

  /**
   * Register a listener that fires exactly ONCE then removes itself.
   *
   * CLOSURE: wrapper closes over both listener and the off() call.
   * When wrapper fires: calls the original listener, then removes wrapper.
   * The original listener is never registered — only wrapper is.
   * off(event, wrapper) removes wrapper — not the original listener reference.
   */
  once<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    const wrapper = (...args: TEvents[K]): void => {
      listener(...args);                // call the original listener
      this.off(event, wrapper as (...args: TEvents[K]) => void); // remove self
    };
    return this.on(event, wrapper as (...args: TEvents[K]) => void);
  }

  /** Returns number of listeners registered for an event. */
  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /** Remove all listeners for all events. */
  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD EVENT BUS — global event system for the dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type-safe event map for the Policy Dashboard.
 * Adding a new event: add its name and argument tuple here.
 * TypeScript enforces correct arguments at every emit() and on() call.
 */
export type DashboardEvents = {
  'claim:submitted':    [claimId: string, amount: number];
  'claim:approved':     [claimId: string, payout: number];
  'claim:rejected':     [claimId: string, reason: string];
  'policy:selected':    [policyId: string];
  'filters:changed':    [filters: Record<string, unknown>];
  'search:performed':   [query: string, resultCount: number];
  'error:occurred':     [message: string, code: number];
  'auth:logout':        [];
};

// Singleton event bus — one instance for the whole dashboard
// Demonstrates: Singleton pattern applied in TypeScript/JavaScript
export const dashboardEvents = new TypedEventEmitter<DashboardEvents>();
