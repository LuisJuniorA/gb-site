import init, { WasmEmulator } from "./wasm/gb_wasm.js";
import { EmulatorContext } from "./js/EmulatorContext.js";
import { Display } from "./js/Display.js";
import { Inputs } from "./js/Inputs.js";

/**
 * Main entry point to initialize the WASM core and JS peripherals.
 */
async function boot() {
    try {
        const wasm = await init();

        new Display('gb-canvas', 'debug-info');
        new Inputs();

        // Bridges WASM core with JavaScript peripherals
        new EmulatorContext(wasm, WasmEmulator);

        console.log("🚀 EmulatorContext initialized and ready.");
    } catch (err) {
        console.error("Emulator boot error:", err);
    }
}

boot();