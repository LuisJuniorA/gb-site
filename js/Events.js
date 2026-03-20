/**
 * Global Event Dictionary to avoid string typos.
 */
export const EVENTS = Object.freeze({
    // Emulation Core
    FRAME_READY: 'core:frame_ready',
    ROM_LOADED: 'core:rom_loaded',
    SAVE_LOADED: 'core:save_loaded',
    EXPORT_SAVE: 'core:export_save',
    DEBUG_UPDATE: 'core:debug_update',
    AUDIO_READY: 'core:audio_ready',

    // Lifecycle
    EMULATOR_STARTED: 'lifecycle:started',
    EMULATOR_STOPPED: 'lifecycle:stopped',

    // Inputs
    GB_KEY_DOWN: 'input:gb_key_down',
    GB_KEY_UP: 'input:gb_key_up',

    // UI & Config
    REQUEST_KEYBIND_CHANGE: 'ui:req_keybind_change',
    REQUEST_KEYBINDS_SYNC: 'ui:req_keybind_sync',
    KEYBINDS_UPDATED: 'ui:keybinds_updated',
    SPEED_CHANGE: 'ui:speed_change',
    VOLUME_CHANGE: 'ui:volume_change',

    // Store State (Dynamic keys are handled via a helper)
    STATE_UPDATED: 'store:updated'
});

/** Helper for Store events */
export const getStoreEvent = (key) => `state_changed:${key.toLowerCase()}`;
