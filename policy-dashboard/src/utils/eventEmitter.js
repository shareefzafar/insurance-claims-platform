/**
 * EventEmitter — Observer pattern for the dashboard.
 * Map stores eventName → [listeners]. Snapshot before iterate.
 */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, listener) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(listener);
    return this;
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return this;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
    return this;
  }

  emit(event, ...args) {
    if (!this._listeners.has(event)) return this;
    [...this._listeners.get(event)].forEach(l => l(...args)); // snapshot first
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => { listener(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  listenerCount(event) {
  return this._listeners.get(event)?.length ?? 0;
  }

  removeAllListeners() {
    this._listeners.clear();
    return this;
  }
}


// Singleton event bus for the whole dashboard
export const dashboardEvents = new EventEmitter();
