import init, { WasmEmulator } from "./wasm/gb_wasm.js";
import { EmulatorContext } from "./js/EmulatorContext.js";
import { Display } from "./js/Display.js";
import { Inputs } from "./js/Inputs.js";
import { UIBuilder } from "./js/UIBuilder.js";
import { AudioPlayer } from "./js/AudioPlayer.js";
import { bus } from "./js/EventBus.js";
import { EVENTS } from "./js/Events.js";
import { MobileMenu } from "./js/MobileMenu.js";
import { Scaler } from "./js/Scaler.js";

/**
 * Main entry point to initialize the WASM core and JS peripherals.
 */
async function boot() {
  try {
    const wasm = await init();

    if (document.readyState === "loading") {
      await new Promise((r) => window.addEventListener("DOMContentLoaded", r));
    }

    new UIBuilder("keybind-list", "speed-val", "volume-val");
    new Inputs();
    new Display("gb-canvas", "debug-info");
    new AudioPlayer();
    new EmulatorContext(wasm, WasmEmulator);

    new MobileMenu();
    new Scaler();

    bus.emit(EVENTS.REQUEST_KEYBINDS_SYNC);

    console.log("🚀 Emulator ready.");
  } catch (err) {
    console.error("Boot error:", err);
  }
}

boot();
