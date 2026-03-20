import { bus } from './EventBus.js';
import { EVENTS, getStoreEvent } from './Events.js';

/**
 * Centralized State Management for the emulator.
 * Ensures a single source of truth and predictable state transitions.
 */
class Store {
    constructor() {
        this.state = {
            isPowered: false,
            speed: 1,
            romName: null,
            isMuted: false,
            volume: 1
        };
    }

    /**
     * Updates a specific state property and notifies the system.
     * @param {string} key 
     * @param {any} value 
     */
    setState(key, value) {
        if (this.state[key] === value) return;

        this.state[key] = value;
        bus.emit(getStoreEvent(key), value); // state_changed:ispowered
        bus.emit(EVENTS.STATE_UPDATED, this.state);
    }

    getState() {
        return { ...this.state };
    }
}

export const store = new Store();
