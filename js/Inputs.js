import { bus } from "./EventBus.js";
import { CONTROLS_CONFIG } from "./config.js";
import { store } from "./Store.js";
import { EVENTS, getStoreEvent } from "./Events.js";

/**
 * Handles keyboard, mouse, touch, and file input events.
 * Maps physical interactions to emulator actions and updates the central Store.
 */
export class Inputs {
  constructor() {
    /** * Immutable emulator key indices (e.g., "btn-a" -> 4).
     * @type {Object<string, number>}
     */
    this.keyValues = {};

    /** * Dynamic mapping: KeyboardEvent.key -> Button ID (e.g., "s" -> "btn-a").
     * @type {Object<string, string>}
     */
    this.idMap = {};

    // Initialize mappings from config
    CONTROLS_CONFIG.forEach((ctrl, index) => {
      this.keyValues[ctrl.id] = index;
      if (ctrl.defaultKey) {
        this.idMap[ctrl.defaultKey] = ctrl.id;
      }
    });

    this.initPowerButton();
    this.initFullscreen();
    this.initKeyboard();
    this.initPhysicalButtons();
    this.initDragAndDrop();
    this.initFileInput();
    this.initSaveInput();
    this.initSpeedInput();

    this.initBusListeners();
  }

  /**
   * Set up listeners for external requests (UI interactions).
   * @private
   */
  initBusListeners() {
    bus.on(EVENTS.REQUEST_KEYBIND_CHANGE, ({ newKey, btnId }) =>
      this.rebindKey(btnId, newKey),
    );
    bus.on(EVENTS.REQUEST_KEYBINDS_SYNC, () => {
      bus.emit(EVENTS.KEYBINDS_UPDATED, this.idMap);
    });
  }

  /**
   * Updates the keyboard mapping and notifies the UI.
   * @param {string} btnId - The internal button ID (e.g., "btn-a").
   * @param {string} newKey - The new KeyboardEvent.key.
   */
  rebindKey(btnId, newKey) {
    // Remove duplicates: ensure one key per action and one action per key
    for (let key in this.idMap) {
      if (key === newKey || this.idMap[key] === btnId) {
        delete this.idMap[key];
      }
    }

    this.idMap[newKey] = btnId;
    bus.emit(EVENTS.KEYBINDS_UPDATED, this.idMap);
  }

  /**
   * Keyboard listeners. System shortcuts (F) vs GameBoy inputs.
   * @private
   */
  initKeyboard() {
    window.addEventListener("keydown", (e) => {
      // System Shortcut: Fullscreen
      if (e.key.toLowerCase() === "f") return this.toggleFullscreen();

      const btnId = this.idMap[e.key];
      if (btnId) {
        bus.emit(EVENTS.GB_KEY_DOWN, this.keyValues[btnId]);
        document.getElementById(btnId)?.classList.add("pressed");
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      const btnId = this.idMap[e.key];
      if (btnId) {
        bus.emit(EVENTS.GB_KEY_UP, this.keyValues[btnId]);
        document.getElementById(btnId)?.classList.remove("pressed");
      }
    });
  }

  /**
   * Updates the Store's power state on click.
   * Reacts to power state changes to update hardware UI indicators.
   * @private
   */
  initPowerButton() {
    const powerSwitch = document.querySelector(".power-switch-area");
    const dome = document.querySelector(".power-dome");
    const batteryIndicator = document.querySelector(".battery-indicator");

    if (!powerSwitch) return;

    // Producer: Update the Store
    powerSwitch.addEventListener("click", () => {
      const isCurrentlyOn = store.getState().isPowered;
      store.setState("isPowered", !isCurrentlyOn);
    });

    // Consumer: React to the Store's truth
    bus.on(getStoreEvent("isPowered"), (isOn) => {
      dome?.classList.toggle("on", isOn);
      batteryIndicator?.classList.toggle("on", isOn);
    });
  }

  /**
   * Standard Fullscreen API implementation.
   * @private
   */
  initFullscreen() {
    const btn = document.getElementById("btn-fullscreen");
    if (btn) btn.addEventListener("click", () => this.toggleFullscreen());
  }

  toggleFullscreen() {
    const screenArea = document.querySelector(".screen-display");
    if (!document.fullscreenElement) {
      screenArea.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * Maps on-screen GameBoy buttons to emulator inputs.
   * Supports both Mouse and Touch events.
   * @private
   */
  initPhysicalButtons() {
    Object.keys(this.keyValues).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const startPress = (e) => {
        e.preventDefault();
        bus.emit(EVENTS.GB_KEY_DOWN, this.keyValues[id]);
        el.classList.add("pressed");
      };

      const endPress = () => {
        bus.emit(EVENTS.GB_KEY_UP, this.keyValues[id]);
        el.classList.remove("pressed");
      };

      el.addEventListener("mousedown", startPress);
      el.addEventListener("touchstart", startPress);
      window.addEventListener("mouseup", endPress);
      window.addEventListener("touchend", endPress);
    });
  }

  /**
   * ROM Drag & Drop functionality.
   * @private
   */
  initDragAndDrop() {
    const dropZone = document.querySelector(".drop-zone-mini");
    if (!dropZone) return;

    ["dragover", "drop"].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => e.preventDefault()),
    );

    dropZone.addEventListener("dragenter", () =>
      dropZone.classList.add("drag-over"),
    );
    dropZone.addEventListener("dragleave", () =>
      dropZone.classList.remove("drag-over"),
    );

    dropZone.addEventListener("drop", async (e) => {
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) bus.emit(EVENTS.ROM_LOADED, await file.arrayBuffer());
    });
  }

  /**
   * Standard file picker for ROM loading.
   * @private
   */
  initFileInput() {
    const input = document.getElementById("rom-upload");
    if (!input) return;

    // Cache the original titles so we don't infinitely append them
    const originalDocumentTitle = document.title;
    const titleElement = document.getElementById("title");
    const originalElementText = titleElement ? titleElement.innerText : "";

    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const romName = file.name;
      document.title = `${originalDocumentTitle} - ${romName}`;
      if (titleElement) {
        titleElement.innerText = `${originalElementText} - ${romName}`;
      }

      bus.emit(EVENTS.ROM_LOADED, await file.arrayBuffer());
    });
  }

  /**
   * Save/Load functionality for state/save files.
   * @private
   */
  initSaveInput() {
    const btnExport = document.getElementById("btn-export-sav");
    if (btnExport) {
      btnExport.addEventListener("click", () => {
        bus.emit(EVENTS.EXPORT_SAVE);
      });
    }

    const btnLoad = document.getElementById("btn-load-state");
    const inputLoad = document.getElementById("sav-upload");
    if (btnLoad && inputLoad) {
      btnLoad.addEventListener("click", () => {
        inputLoad.click();
      });
      inputLoad.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) bus.emit(EVENTS.SAVE_LOADED, await file.arrayBuffer());
        e.target.value = ""; // Reset input to allow reloading the same file
      });
    }
  }

  /**
   * Producer: Updates the Store speed when the slider moves.
   * @private
   */
  initSpeedInput() {
    const input = document.getElementById("speed-input");
    if (!input) return;

    input.addEventListener("input", (e) => {
      const newSpeed = 1 << parseFloat(e.target.value);
      store.setState("speed", newSpeed);
      bus.emit(EVENTS.SPEED_CHANGE, newSpeed);
    });
  }
}
