import { bus } from './EventBus.js';
import { EVENTS } from './Events.js';

/**
 * Manages the emulator's visual output, focusing strictly on canvas rendering,
 * power states, and performance debug information.
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

        this.initCanvas();
        this.initEventListeners();
    }

    /**
     * Subscribes to core emulation events via the EventBus.
     * @private
     */
    initEventListeners() {
        bus.on(EVENTS.FRAME_READY, ({ ptr, buffer }) => this.draw(ptr, buffer));
        bus.on(EVENTS.DEBUG_UPDATE, (data) => this.updateDebug(data));
        bus.on(EVENTS.EMULATOR_STARTED, () => this.setPowerState(true));
        bus.on(EVENTS.EMULATOR_STOPPED, () => this.setPowerState(false));
    }

    /**
     * Updates the visual state of the display and hardware indicators.
     * @param {boolean} isOn - Whether the emulator is powered on.
     */
    setPowerState(isOn) {
        this.canvas.style.opacity = isOn ? "1" : "0";
        this.batteryLed?.classList.toggle('on', isOn);

        if (!isOn) {
            setTimeout(() => this.clearScreen(), 800);
        }
    }

    /**
     * Renders a raw RGBA pixel buffer from WASM memory to the canvas.
     * @param {number} ptr - Memory pointer to the start of the frame buffer.
     * @param {ArrayBuffer} buffer - The shared WASM linear memory buffer.
     */
    draw(ptr, buffer) {
        const frameData = new Uint8ClampedArray(buffer, ptr, 160 * 144 * 4);
        this.ctx.putImageData(new ImageData(frameData, 160, 144), 0, 0);
    }

    /**
     * Initializes canvas dimensions and initial background state.
     * @private
     */
    initCanvas() {
        this.canvas.width = 160;
        this.canvas.height = 144;
        this.clearScreen();
    }

    /**
     * Fills the screen with a neutral dark color.
     */
    clearScreen() {
        this.ctx.fillStyle = '#080808';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Updates the debug overlay with internal CPU and PPU status.
     * @param {Object} data - Object containing pc (Program Counter) and ly (Current Scanline).
     */
    updateDebug({ pc, ly }) {
        if (this.debugArea) {
            const hexPC = pc.toString(16).toUpperCase().padStart(4, '0');
            this.debugArea.textContent = `PC: 0x${hexPC} | LY: ${ly}`;
        }
    }
}