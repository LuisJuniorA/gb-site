import { bus } from './EventBus.js';

/**
 * Handles keyboard, mouse, touch, and file input events.
 * Maps physical interactions to emulator actions via EventBus.
 */
export class Inputs {
    constructor() {
        /** * Immutable emulator key indices.
         * @type {Object<string, number>} 
         */
        this.keyValues = {
            "ctrl-right": 0, "ctrl-left": 1, "ctrl-up": 2, "ctrl-down": 3,
            "btn-a": 4, "btn-b": 5, "btn-select": 6, "btn-start": 7
        };

        /** * Dynamic mapping: KeyboardEvent.key -> DOM ID.
         * @type {Object<string, string>} 
         */
        this.idMap = {
            "ArrowUp": "ctrl-up", "ArrowDown": "ctrl-down", "ArrowLeft": "ctrl-left", "ArrowRight": "ctrl-right",
            "s": "btn-a", "x": "btn-b", "Shift": "btn-select", "Enter": "btn-start"
        };

        this.initPowerButton();
        this.initFullscreen();
        this.initKeyboard();
        this.initPhysicalButtons();
        this.initDragAndDrop();
        this.initFileInput();

        /** Listen for rebind requests from UI */
        bus.on('REQUEST_KEYBIND_CHANGE', ({ newKey, btnId }) => this.rebindKey(btnId, newKey));

        /** Initial UI synchronization */
        setTimeout(() => bus.emit('KEYBINDS_UPDATED', this.idMap), 100);
    }

    /**
     * Updates the mapping by removing duplicates and assigning the new key.
     * @param {string} btnId - The internal button ID to rebind.
     * @param {string} newKey - The new keyboard key to assign.
     */
    rebindKey(btnId, newKey) {
        // Remove any existing key using this btnId OR any btnId already using this newKey
        for (let key in this.idMap) {
            if (key === newKey || this.idMap[key] === btnId) {
                delete this.idMap[key];
            }
        }

        this.idMap[newKey] = btnId;
        bus.emit('KEYBINDS_UPDATED', this.idMap);
    }

    /**
     * Set up keyboard listeners for emulator controls and system shortcuts.
     * @private
     */
    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f') return this.toggleFullscreen();

            const btnId = this.idMap[e.key];
            if (btnId) {
                bus.emit('GB_KEY_DOWN', this.keyValues[btnId]);
                document.getElementById(btnId)?.classList.add('pressed');
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            const btnId = this.idMap[e.key];
            if (btnId) {
                bus.emit('GB_KEY_UP', this.keyValues[btnId]);
                document.getElementById(btnId)?.classList.remove('pressed');
            }
        });
    }

    /**
     * Set up power button logic and listener for power state UI updates.
     * @private
     */
    initPowerButton() {
        const powerSwitch = document.querySelector('.power-switch-area');
        const dome = document.querySelector('.power-dome');
        const batteryIndicator = document.querySelector('.battery-indicator');
        if (!powerSwitch) return;

        powerSwitch.addEventListener('click', () => bus.emit('POWER_TOGGLE'));
        bus.on('POWER_STATE_CHANGE', (isOn) => {
            dome?.classList.toggle('on', isOn);
            batteryIndicator?.classList.toggle('on', isOn);
        });
    }

    /**
     * Initialize fullscreen button listener.
     * @private
     */
    initFullscreen() {
        const fullscreenBtn = document.getElementById('btn-fullscreen');
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    /**
     * Toggles fullscreen mode for the screen display area.
     */
    toggleFullscreen() {
        const screenArea = document.querySelector('.screen-display');
        if (!document.fullscreenElement) {
            screenArea.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Binds physical on-screen buttons to emulator inputs with touch support.
     * @private
     */
    initPhysicalButtons() {
        Object.keys(this.keyValues).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const startPress = (e) => {
                e.preventDefault();
                bus.emit('GB_KEY_DOWN', this.keyValues[id]);
                el.classList.add('pressed');
            };
            const endPress = () => {
                bus.emit('GB_KEY_UP', this.keyValues[id]);
                el.classList.remove('pressed');
            };
            el.addEventListener('mousedown', startPress);
            el.addEventListener('touchstart', startPress);
            window.addEventListener('mouseup', endPress);
            window.addEventListener('touchend', endPress);
        });
    }

    /**
     * Enable ROM loading via drag and drop on the document body.
     * @private
     */
    initDragAndDrop() {
        const dropZone = document.querySelector('.drop-zone-mini');
        if (!dropZone) return;
        ['dragover', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => e.preventDefault()));
        dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-over'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', async (e) => {
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) bus.emit('ROM_LOADED', await file.arrayBuffer());
        });
    }

    /**
     * Set up standard file input for ROM uploading.
     * @private
     */
    initFileInput() {
        const input = document.getElementById('rom-upload');
        if (input) {
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) bus.emit('ROM_LOADED', await file.arrayBuffer());
            });
        }
    }
}