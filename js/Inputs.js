import { bus } from "./EventBus.js";
import { CONTROLS_CONFIG } from "./config.js";
import { store } from "./Store.js";
import { EVENTS, getStoreEvent } from "./Events.js";

export class Inputs {
  constructor() {
    this.keyValues = {};
    this.idMap = {};

    // Cache for the modal flow
    this.pendingRomBuffer = null;
    this.pendingRomName = "";
    this.baseDocumentTitle = document.title;

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
    this.initVolumeInput();
    this.initModal();

    this.initBusListeners();
  }

  initBusListeners() {
    bus.on(EVENTS.REQUEST_KEYBIND_CHANGE, ({ newKey, btnId }) =>
      this.rebindKey(btnId, newKey),
    );
    bus.on(EVENTS.REQUEST_KEYBINDS_SYNC, () => {
      bus.emit(EVENTS.KEYBINDS_UPDATED, this.idMap);
    });
  }

  rebindKey(btnId, newKey) {
    for (let key in this.idMap) {
      if (key === newKey || this.idMap[key] === btnId) {
        delete this.idMap[key];
      }
    }
    this.idMap[newKey] = btnId;
    bus.emit(EVENTS.KEYBINDS_UPDATED, this.idMap);
  }

  initKeyboard() {
    window.addEventListener("keydown", (e) => {
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

  initPowerButton() {
    const powerSwitch = document.querySelector(".power-switch-area");
    const dome = document.querySelector(".power-dome");
    const batteryIndicator = document.querySelector(".battery-indicator");

    if (!powerSwitch) return;

    powerSwitch.addEventListener("click", () => {
      const isCurrentlyOn = store.getState().isPowered;
      store.setState("isPowered", !isCurrentlyOn);
    });

    bus.on(getStoreEvent("isPowered"), (isOn) => {
      dome?.classList.toggle("on", isOn);
      batteryIndicator?.classList.toggle("on", isOn);
    });
  }

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

  async processRomFile(file) {
    if (!file) return;
    this.pendingRomName = file.name;
    this.pendingRomBuffer = await file.arrayBuffer();

    const pref = localStorage.getItem("savePreference");

    if (pref === "never") {
      document.title = `${this.baseDocumentTitle} - ${this.pendingRomName}`;

      bus.emit(EVENTS.ROM_LOADED, {
        romBuffer: this.pendingRomBuffer,
        saveBuffer: null,
      });

      this.pendingRomBuffer = null;
      this.pendingRomName = "";
    } else if (pref === "always") {
      const saveInput = document.getElementById("modal-sav-upload");
      if (saveInput) saveInput.click();
    } else {
      const checkbox = document.getElementById("modal-dont-ask");
      if (checkbox) checkbox.checked = false;
      document.getElementById("save-modal")?.classList.add("active");
    }
  }

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

    dropZone.addEventListener("drop", (e) => {
      dropZone.classList.remove("drag-over");
      this.processRomFile(e.dataTransfer.files[0]);
    });
  }

  initFileInput() {
    const input = document.getElementById("rom-upload");
    if (!input) return;

    input.addEventListener("change", (e) => {
      this.processRomFile(e.target.files[0]);
      e.target.value = ""; // Reset input
    });
  }

  initModal() {
    const modal = document.getElementById("save-modal");
    const btnYes = document.getElementById("modal-btn-yes");
    const btnNo = document.getElementById("modal-btn-no");
    const saveInput = document.getElementById("modal-sav-upload");
    const dontAskCheckbox = document.getElementById("modal-dont-ask");

    if (!modal) return;

    // Added a userChoice parameter to track "always" or "never"
    const finalizeRomLoad = (saveBuffer = null, userChoice = null) => {
      if (dontAskCheckbox && dontAskCheckbox.checked && userChoice) {
        localStorage.setItem("savePreference", userChoice);
      }

      modal.classList.remove("active");
      document.title = `${this.baseDocumentTitle} - ${this.pendingRomName}`;

      bus.emit(EVENTS.ROM_LOADED, {
        romBuffer: this.pendingRomBuffer,
        saveBuffer: saveBuffer,
      });

      this.pendingRomBuffer = null;
      this.pendingRomName = "";
    };

    // If they click NO, save the preference as "never"
    btnNo.addEventListener("click", () => finalizeRomLoad(null, "never"));

    btnYes.addEventListener("click", () => saveInput.click());

    saveInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const saveBuffer = await file.arrayBuffer();
      // If they click YES and select a file, save the preference as "always"
      finalizeRomLoad(saveBuffer, "always");
      e.target.value = "";
    });
  }

  initSaveInput() {
    const btnExport = document.getElementById("btn-export-sav");
    if (btnExport) {
      btnExport.addEventListener("click", () => bus.emit(EVENTS.EXPORT_SAVE));
    }

    const btnLoad = document.getElementById("btn-load-save");
    const inputLoad = document.getElementById("sav-upload");
    if (btnLoad && inputLoad) {
      btnLoad.addEventListener("click", () => inputLoad.click());
      inputLoad.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) bus.emit(EVENTS.SAVE_LOADED, await file.arrayBuffer());
        e.target.value = "";
      });
    }
  }

  initSpeedInput() {
    const input = document.getElementById("speed-input");
    if (!input) return;

    input.addEventListener("input", (e) => {
      const newSpeed = 1 << parseFloat(e.target.value);
      store.setState("speed", newSpeed);
      bus.emit(EVENTS.SPEED_CHANGE, newSpeed);
    });
  }

  initVolumeInput() {
    const input = document.getElementById("volume-input");
    if (!input) return;

    input.addEventListener("input", (e) => {
      const volume = Math.max(0, Math.min(1, parseFloat(e.target.value) / 100));
      store.setState("volume", volume);
      bus.emit(EVENTS.VOLUME_CHANGE, volume);
    });
  }
}
