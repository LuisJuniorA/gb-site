/**
 * Simple pub-sub event bus for cross-component communication.
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Register an event listener.
     * @param {string} name - Event name.
     * @param {Function} callback - Function to execute when event is emitted.
     */
    on(name, callback) {
        if (!this.events[name]) this.events[name] = [];
        this.events[name].push(callback);
    }

    /**
     * Trigger all callbacks registered for a specific event.
     * @param {string} name - Event name.
     * @param {any} data - Data to pass to the callbacks.
     */
    emit(name, data) {
        if (this.events[name]) {
            this.events[name].forEach(callback => callback(data));
        }
    }
}

export const bus = new EventBus();