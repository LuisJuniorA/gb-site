export class Scaler {
  constructor() {
    this.container = document.querySelector('.gameboy-container');
    this.update();
    window.addEventListener('resize', () => this.update());
  }

  update() {
    if (!this.container) return;
    // 540 = natural gameboy width. Clamp to max 1 so it never grows past natural size.
    const scale = Math.min(1, window.innerWidth / 540);
    this.container.style.setProperty('--gb-scale', scale);
  }
}
