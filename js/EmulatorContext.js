import { bus } from "./EventBus.js";
import { store } from "./Store.js";
import { EVENTS, getStoreEvent } from "./Events.js";

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
    /** @type {ArrayBuffer|null} */
    this.currentRomBuffer = null;

    this.initEventListeners();
  }

  /**
   * Set up event listeners for state changes, ROM loading, and inputs.
   * @private
   */
  initEventListeners() {
    bus.on(getStoreEvent("isPowered"), (isOn) => {
      isOn ? this.boot() : this.shutdown();
    });

    bus.on(EVENTS.ROM_LOADED, (payload) => {
      if (payload.romBuffer) {
        this.insertCartridge(payload.romBuffer, payload.saveBuffer);
      } else {
        this.insertCartridge(payload);
      }
    });

    bus.on(EVENTS.SAVE_LOADED, (buffer) => this.loadSave(buffer));
    bus.on(EVENTS.EXPORT_SAVE, () => this.exportSave());
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
   * @param {ArrayBuffer|null} [saveDataBuffer=null]
   */
  insertCartridge(romBuffer, saveDataBuffer = null) {
    this.currentRomBuffer = romBuffer;

    // Force power off before swapping instance
    store.setState("isPowered", false);

    // Instantiate new core with ROM data
    const romArray = new Uint8Array(romBuffer);
    const saveArray = saveDataBuffer ? new Uint8Array(saveDataBuffer) : null;
    this.instance = new this.WasmEmulatorClass(romArray, saveArray);

    // Power back on via Store
    store.setState("isPowered", true);
  }

  /**
   * Loads save data into the current ROM.
   * @param {ArrayBuffer} saveDataBuffer
   */
  loadSave(saveDataBuffer) {
    if (!this.currentRomBuffer) {
      console.warn("Cannot load save data without a loaded ROM.");
      return;
    }
    this.insertCartridge(this.currentRomBuffer, saveDataBuffer);
  }

  /**
   * Exports the current save data as a .sav file download.
   */
  exportSave() {
    if (!this.instance) return;
    const saveData = this.instance.get_save_data();
    if (saveData && saveData.length > 0) {
      const blob = new Blob([saveData], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "save.sav";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      console.warn("No save data available to export.");
    }
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
        for (let i = 0; i < store.getState().speed; i++) {
          this.instance.clock_frame();

          const audioData = this.instance.get_audio_buffer();
          if (audioData.length > 0) {
            bus.emit(EVENTS.AUDIO_READY, audioData);
          }
        }
        // Dispatch frame data for the Display component
        bus.emit(EVENTS.FRAME_READY, {
          ptr: this.instance.get_frame_buffer_ptr(),
          buffer: this.wasmMemory.buffer,
        });
      }

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }
}
