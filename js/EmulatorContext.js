import { bus } from './EventBus.js';
import { store } from './Store.js';
import { EVENTS, getStoreEvent } from './Events.js';

/**
 * Manages the lifecycle of the WASM emulator instance and coordinates with JS peripherals.
 * Reactive implementation: observes the Store for state changes.
 */
export class EmulatorContext {
    /**
     * @param {Object} wasmInstance - Loaded WASM module instance.
     * @param {Function} WasmEmulatorClass - Constructor for the emulator core.
     */
    constructor(wasmInstance, WasmEmulatorClass) {
        /** @type {WebAssembly.Memory} */
        this.wasmMemory = wasmInstance.memory;
        /** @type {Function} */
        this.WasmEmulatorClass = WasmEmulatorClass;
        /** @type {Object|null} */
        this.instance = null;
        /** @type {number|null} */
        this.animationId = null;

        this.initEventListeners();
    }

    /**
     * Set up event listeners for state changes, ROM loading, and inputs.
     * @private
     */
    initEventListeners() {
        bus.on(getStoreEvent('isPowered'), (isOn) => {
            isOn ? this.boot() : this.shutdown();
        });

        bus.on(EVENTS.ROM_LOADED, (buffer) => this.insertCartridge(buffer));
        bus.on(EVENTS.GB_KEY_DOWN, (key) => this.instance?.key_down(key));
        bus.on(EVENTS.GB_KEY_UP, (key) => this.instance?.key_up(key));
    }

    /**
     * Internal logic to start the emulation.
     * Triggered when store.isPowered becomes true.
     * @private
     */
    boot() {
        if (!this.instance) return;
        this.startLoop();
        bus.emit(EVENTS.EMULATOR_STARTED);
    }

    /**
     * Internal logic to stop the emulation.
     * Triggered when store.isPowered becomes false.
     * @private
     */
    shutdown() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        bus.emit(EVENTS.EMULATOR_STOPPED);
    }

    /**
     * Loads a ROM buffer into a new emulator instance and powers it on.
     * @param {ArrayBuffer} romBuffer 
     */
    insertCartridge(romBuffer) {
        // Force power off before swapping instance
        store.setState('isPowered', false);

        // Instantiate new core with ROM data
        this.instance = new this.WasmEmulatorClass(new Uint8Array(romBuffer));

        // Power back on via Store
        store.setState('isPowered', true);
    }

    /**
     * Main emulation loop synchronized with the screen refresh rate.
     * Logic is only executed if the Store indicates the system is powered.
     * @private
     */
    startLoop() {
        const loop = () => {
            // Check Store state for safety
            if (!store.getState().isPowered) return;

            if (this.instance) {
		for (let i = 0; i < store.getState().speed; i++){
                	this.instance.clock_frame();
		}
                // Dispatch frame data for the Display component
                bus.emit(EVENTS.FRAME_READY, {
                    ptr: this.instance.get_frame_buffer_ptr(),
                    buffer: this.wasmMemory.buffer
                });
            }

            this.animationId = requestAnimationFrame(loop);
        };

        this.animationId = requestAnimationFrame(loop);
    }
}
