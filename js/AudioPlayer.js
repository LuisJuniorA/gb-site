import { bus } from "./EventBus.js";
import { EVENTS, getStoreEvent } from "./Events.js";
import { store } from "./Store.js";

export class AudioPlayer {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext({ sampleRate: 44100 });
    this.nextStartTime = this.ctx.currentTime;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = store.getState().volume ?? 1;
    this.gainNode.connect(this.ctx.destination);

    this.initEventListeners();
  }

  initEventListeners() {
    bus.on(EVENTS.AUDIO_READY, (interleavedData) =>
      this.queueAudio(interleavedData),
    );

    bus.on(getStoreEvent("isPowered"), (isOn) => {
      if (isOn && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    });

    bus.on(getStoreEvent("volume"), (volume) => {
      this.setVolume(volume);
    });
  }

  setVolume(volume) {
    const safeVolume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.setTargetAtTime(
      safeVolume,
      this.ctx.currentTime,
      0.01,
    );
  }

  queueAudio(interleavedData) {
    const state = store.getState();
    if (interleavedData.length === 0 || state.isMuted) return;

    const frameCount = interleavedData.length / 2;
    const audioBuffer = this.ctx.createBuffer(
      2,
      frameCount,
      this.ctx.sampleRate,
    );

    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);

    for (let i = 0; i < frameCount; i++) {
      left[i] = interleavedData[i * 2];
      right[i] = interleavedData[i * 2 + 1];
    }

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;

    source.playbackRate.value = state.speed;

    source.connect(this.gainNode);

    if (this.nextStartTime < this.ctx.currentTime) {
      this.nextStartTime = this.ctx.currentTime + 0.02;
    }

    if (this.nextStartTime > this.ctx.currentTime + 0.5) {
      this.nextStartTime = this.ctx.currentTime + 0.05;
    }

    source.start(this.nextStartTime);

    this.nextStartTime += audioBuffer.duration / state.speed;
  }
}
