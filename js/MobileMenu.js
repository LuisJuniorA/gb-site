export class MobileMenu {
  constructor() {
    this.toggleLeft = document.getElementById("toggle-left");
    this.toggleRight = document.getElementById("toggle-right");
    this.sidebarLeft = document.getElementById("sidebar-left");
    this.sidebarRight = document.getElementById("sidebar-right");
    this.backdrop = document.getElementById("mobile-backdrop");

    this.initListeners();
  }

  closeAll() {
    this.sidebarLeft?.classList.remove("open");
    this.sidebarRight?.classList.remove("open");
    this.backdrop?.classList.remove("active");
  }

  initListeners() {
    if (!this.toggleLeft || !this.toggleRight) return;

    this.toggleLeft.addEventListener("click", () => {
      const isOpen = this.sidebarLeft.classList.contains("open");
      this.closeAll();
      if (!isOpen) {
        this.sidebarLeft.classList.add("open");
        this.backdrop.classList.add("active");
      }
    });

    this.toggleRight.addEventListener("click", () => {
      const isOpen = this.sidebarRight.classList.contains("open");
      this.closeAll();
      if (!isOpen) {
        this.sidebarRight.classList.add("open");
        this.backdrop.classList.add("active");
      }
    });

    this.backdrop?.addEventListener("click", () => this.closeAll());
  }
}
