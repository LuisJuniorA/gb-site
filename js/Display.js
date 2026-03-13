import { bus } from './EventBus.js';

/**
 * Manages the emulator's visual output, including canvas rendering,
 * debug overlays, and power-state transitions.
 */
export class Display {
    /**
     * @param {string} canvasId - The DOM ID of the Game Boy screen canvas element.
     * @param {string} debugId - The DOM ID for the debug information overlay container.
     */
    constructor(canvasId, debugId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.debugArea = document.getElementById(debugId);
        this.batteryLed = document.querySelector('.battery-indicator');

        /** * Maps internal IDs to user-friendly labels in the UI.
         * @type {Object<string, string>} 
         */
        this.labelMap = {
            "ctrl-up": "UP", "ctrl-down": "DOWN", "ctrl-left": "LEFT", "ctrl-right": "RIGHT",
            "btn-a": "A", "btn-b": "B", "btn-select": "SELECT", "btn-start": "START"
        };

        this.initCanvas();
        this.initEventListeners();
        this.initClickListeners();
    }

    /**
     * Initializes click listeners on KBD elements to allow key remapping.
     * @private
     */
    initClickListeners() {
        const kbdElements = document.querySelectorAll('.keybind-list kbd');
        kbdElements.forEach(kbd => {
            kbd.style.cursor = 'pointer';
            kbd.addEventListener('click', () => {
                const label = kbd.parentElement.querySelector('span').textContent.trim();
                const btnId = Object.keys(this.labelMap).find(key => this.labelMap[key] === label);

                kbd.textContent = "...";
                kbd.classList.add('waiting');

                const handleNextKey = (event) => {
                    event.preventDefault();
                    bus.emit('REQUEST_KEYBIND_CHANGE', { newKey: event.key, btnId: btnId });
                    kbd.classList.remove('waiting');
                    window.removeEventListener('keydown', handleNextKey);
                };
                window.addEventListener('keydown', handleNextKey);
            });
        });
    }

    /**
     * Dynamically updates the <kbd> tags in the sidebar based on the provided idMap.
     * @param {Object} idMap - Mapping of KeyboardEvent keys to emulator button IDs.
     */
    updateKeybindUI(idMap) {
        const listItems = document.querySelectorAll('.keybind-list li');
        const arrowSymbols = { "ArrowUp": "↑", "ArrowDown": "↓", "ArrowLeft": "←", "ArrowRight": "→" };

        listItems.forEach(li => {
            const labelSpan = li.querySelector('span');
            const kbdTag = li.querySelector('kbd');
            if (!labelSpan || !kbdTag) return;

            const buttonLabel = labelSpan.textContent.trim();
            const entry = Object.entries(idMap).find(([_, btnId]) => this.labelMap[btnId] === buttonLabel);

            if (entry) {
                let displayKey = entry[0];
                kbdTag.textContent = arrowSymbols[displayKey] || (displayKey === " " ? "Space" : displayKey);
                kbdTag.style.opacity = "1";
            } else {
                kbdTag.textContent = "?";
                kbdTag.style.opacity = "0.5";
            }
        });
    }

    /**
     * Subscribes to global bus events.
     * @private
     */
    initEventListeners() {
        bus.on('FRAME_READY', ({ ptr, buffer }) => this.draw(ptr, buffer));
        bus.on('DEBUG_UPDATE', (data) => this.updateDebug(data));
        bus.on('EMULATOR_STARTED', () => this.powerOn());
        bus.on('EMULATOR_STOPPED', () => this.powerOff());
        bus.on('KEYBINDS_UPDATED', (idMap) => this.updateKeybindUI(idMap));
    }

    /**
     * Triggers the "Power On" visual state.
     */
    powerOn() {
        this.canvas.style.opacity = "1";
        this.batteryLed?.classList.add('on');
    }

    /**
     * Triggers the "Power Off" visual state.
     */
    powerOff() {
        this.canvas.style.opacity = "0";
        this.batteryLed?.classList.remove('on');
        setTimeout(() => this.clearScreen(), 800);
    }

    /**
     * Resets the canvas by filling it with a default color.
     */
    clearScreen() {
        this.ctx.fillStyle = '#080808';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Renders a raw RGBA pixel buffer to the canvas.
     * @param {number} ptr - Memory pointer.
     * @param {ArrayBuffer} buffer - WASM memory buffer.
     */
    draw(ptr, buffer) {
        const frameData = new Uint8ClampedArray(buffer, ptr, 160 * 144 * 4);
        this.ctx.putImageData(new ImageData(frameData, 160, 144), 0, 0);
    }

    /**
     * Sets internal canvas dimensions.
     * @private
     */
    initCanvas() {
        this.canvas.width = 160;
        this.canvas.height = 144;
        this.clearScreen();
    }

    /**
     * Updates the debug overlay with CPU/PPU info.
     * @param {Object} data - Register data.
     */
    updateDebug({ pc, ly }) {
        if (this.debugArea) {
            this.debugArea.textContent = `PC: 0x${pc.toString(16).toUpperCase().padStart(4, '0')} | LY: ${ly}`;
        }
    }
}