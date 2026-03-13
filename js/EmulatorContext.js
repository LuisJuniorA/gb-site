import { bus } from './EventBus.js';

/**
 * Manages the lifecycle of the WASM emulator instance and coordinates with JS peripherals.
 */
export class EmulatorContext {
    /**
     * @param {Object} wasmInstance - Loaded WASM module instance.
     * @param {Function} WasmEmulatorClass - Constructor for the emulator core.
     */
    constructor(wasmInstance, WasmEmulatorClass) {
        this.wasmMemory = wasmInstance.memory;
        this.WasmEmulatorClass = WasmEmulatorClass;
        this.instance = null;
        this.animationId = null;
        this.isPowered = false;

        this.initEventListeners();
    }

    /**
         * Set up event listeners for console power, ROM loading, and inputs.
         */
    initEventListeners() {
        bus.on('POWER_TOGGLE', () => this.togglePower());

        bus.on('ROM_LOADED', (buffer) => {
            this.isPowered = false;
            this.togglePower();
            this.insertCartridge(buffer);
        });

        bus.on('GB_KEY_DOWN', (key) => this.instance?.key_down(key));
        bus.on('GB_KEY_UP', (key) => this.instance?.key_up(key));
    }

    /**
     * Toggles the power state and manages the emulation loop.
     */
    togglePower() {
        if (!this.isPowered) {
            this.isPowered = true;
            this.startLoop();

            bus.emit('POWER_STATE_CHANGE', true);
            bus.emit('EMULATOR_STARTED');
        } else {
            this.isPowered = false;
            cancelAnimationFrame(this.animationId);

            this.instance = null; // Reset core instance

            bus.emit('POWER_STATE_CHANGE', false);
            bus.emit('EMULATOR_STOPPED');
        }
    }

    /**
     * Loads a ROM buffer into a new emulator instance.
     * @param {ArrayBuffer} romBuffer 
     */
    insertCartridge(romBuffer) {
        this.isPowered = true;
        if (this.animationId) cancelAnimationFrame(this.animationId);

        this.instance = new this.WasmEmulatorClass(new Uint8Array(romBuffer));
        this.startLoop();
        bus.emit('POWER_STATE_CHANGE', true);
    }

    /**
     * Main emulation loop synchronized with the screen refresh rate.
     */
    startLoop() {
        const loop = () => {
            if (!this.isPowered) return;

            if (this.instance) {
                this.instance.clock_frame();
                bus.emit('FRAME_READY', {
                    ptr: this.instance.get_frame_buffer_ptr(),
                    buffer: this.wasmMemory.buffer
                });
            }

            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }
}