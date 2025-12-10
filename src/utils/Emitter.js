/**
 * Event Emitter utility for WebRTC communication
 * Provides on, off, emit methods for event-driven architecture
 */
class Emitter {
  constructor() {
    this.events = {};
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((fn) => fn(...args));
    }
    return this;
  }

  on(event, fn) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (event && typeof fn === "function") {
      const listeners = this.events[event];
      if (listeners) {
        const index = listeners.findIndex((_fn) => _fn === fn);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else if (event) {
      this.events[event] = [];
    }
    return this;
  }
}

export default Emitter;

