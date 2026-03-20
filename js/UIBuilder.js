import { CONTROLS_CONFIG } from "./config.js";
import { bus } from "./EventBus.js";
import { EVENTS } from "./Events.js";

/**
 * UIBuilder is responsible for rendering and updating the emulator's
 * peripheral UI elements, such as the keybinding list and speed labels.
 */
export class UIBuilder {
  /**
   * @param {string} listContainerId - The DOM ID for the <ul> container of keybinds.
   * @param {string} speedLabelId - The DOM ID for the span/div displaying current speed.
   * @param {string} [volumeLabelId] - The DOM ID for the span/div displaying current volume.
   */
  constructor(listContainerId, speedLabelId, volumeLabelId) {
    /** @type {HTMLElement|null} */
    this.container = document.getElementById(listContainerId);
    /** @type {HTMLElement|null} */
    this.speedLabel = document.getElementById(speedLabelId);
    /** @type {HTMLElement|null} */
    this.volumeLabel = volumeLabelId
      ? document.getElementById(volumeLabelId)
      : null;

    this.initEventListeners();
    this.initClickListeners();
    this.renderList();
  }

  /**
   * Subscribes to global events via the EventBus to sync UI with internal state.
   * @private
   */
  initEventListeners() {
    // Updates the speed multiplier display (e.g., "2x")
    bus.on(EVENTS.SPEED_CHANGE, (speed) => this.updateSpeedLabel(speed));
    bus.on(EVENTS.VOLUME_CHANGE, (volume) => this.updateVolumeLabel(volume));

    // Syncs the entire keybinding list when the mapping changes
    bus.on(EVENTS.KEYBINDS_UPDATED, (idMap) => {
      CONTROLS_CONFIG.forEach((ctrl) => {
        const physicalKey = Object.keys(idMap).find(
          (key) => idMap[key] === ctrl.id,
        );
        this.updateKbd(ctrl.id, physicalKey);
      });
    });
  }

  /**
   * Generates the initial HTML list of controls based on the configuration.
   * Elements are sorted by a specific visual order (D-Pad then Buttons).
   * @private
   */
  renderList() {
    if (!this.container) return;

    const visualOrder = [
      "ctrl-up",
      "ctrl-down",
      "ctrl-left",
      "ctrl-right",
      "btn-a",
      "btn-b",
      "btn-select",
      "btn-start",
    ];
    const sorted = [...CONTROLS_CONFIG].sort(
      (a, b) => visualOrder.indexOf(a.id) - visualOrder.indexOf(b.id),
    );

    this.container.innerHTML = sorted
      .map(
        (ctrl) => `
            <li data-btn-id="${ctrl.id}">
                <span>${ctrl.label}</span>
                <kbd>?</kbd>
            </li>
        `,
      )
      .join("");
  }

  /**
   * Updates a specific <kbd> element text and style.
   * @param {string} btnId - The internal ID of the button (e.g., "btn-a").
   * @param {string|null} physicalKey - The name of the keyboard key (e.g., "ArrowUp").
   * @param {boolean} [isWaiting=false] - If true, shows a loading state for rebinding.
   */
  updateKbd(btnId, physicalKey, isWaiting = false) {
    const li = this.container?.querySelector(`li[data-btn-id="${btnId}"]`);
    const kbd = li?.querySelector("kbd");
    if (!kbd) return;

    if (isWaiting) {
      kbd.textContent = "...";
      kbd.classList.add("waiting");
      return;
    }

    kbd.classList.remove("waiting");
    kbd.textContent = physicalKey ? this.formatKeyName(physicalKey) : "?";
    kbd.style.opacity = physicalKey ? "1" : "0.5";
  }

  /**
   * Updates the text content of the speed indicator.
   * @param {number|string} speed - The numerical speed value.
   */
  updateSpeedLabel(speed) {
    if (this.speedLabel) this.speedLabel.textContent = `${speed}x`;
  }

  /**
   * Updates the text content of the volume indicator.
   * @param {number} volume - The numerical volume (0..1).
   */
  updateVolumeLabel(volume) {
    if (this.volumeLabel) {
      this.volumeLabel.textContent = `${Math.round(volume * 100)}%`;
    }
  }

  /**
   * Converts raw KeyboardEvent.key strings into user-friendly symbols or names.
   * @param {string} key - The raw key string from the event.
   * @returns {string} The formatted string or symbol.
   */
  formatKeyName(key) {
    if (!key) return "?";
    const symbols = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      " ": "Space",
      Control: "Ctrl",
      Shift: "⇧",
      Enter: "↵",
    };
    return symbols[key] || (key.length === 1 ? key.toUpperCase() : key);
  }

  /**
   * Sets up click listeners on the list to enter "listening mode" for new keybinds.
   * Once a <kbd> is clicked, the next key pressed will trigger a rebind.
   * @private
   */
  initClickListeners() {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const kbd = e.target.closest("kbd");
      if (!kbd) return;

      const btnId = kbd.closest("li").dataset.btnId;

      // Visual feedback: show "..." while waiting for a key press
      this.updateKbd(btnId, null, true);

      const handleNextKey = (event) => {
        event.preventDefault();
        // Notify the Inputs system to change the keybind
        bus.emit(EVENTS.REQUEST_KEYBIND_CHANGE, { newKey: event.key, btnId });
        // Cleanup to avoid multiple listeners
        window.removeEventListener("keydown", handleNextKey);
      };

      window.addEventListener("keydown", handleNextKey);
    });
  }
}
