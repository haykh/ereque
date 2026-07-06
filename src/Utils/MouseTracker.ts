import type { Camera } from "three";
import { Raycaster, Vector2 } from "three";

interface MouseTrackerOptions {
  sizes: { width: number; height: number };
}

export default class MouseTracker {
  private sizes: { width: number; height: number };
  public raycaster: Raycaster;

  public screenCursor = new Vector2(999, 999);
  public prevCanvasCursor = new Vector2(999, 999);
  public canvasCursor = new Vector2(999, 999);
  public shiftDown = false;
  public clicked = false;

  constructor(opts: MouseTrackerOptions) {
    this.sizes = opts.sizes;
    this.raycaster = new Raycaster();

    document.addEventListener("pointermove", (event) => {
      this.screenCursor.set(
        (event.clientX / this.sizes.width) * 2 - 1,
        -(event.clientY / this.sizes.height) * 2 + 1,
      );
    });
    document.addEventListener("pointerdown", () => {
      this.clicked = true;
    });
    document.addEventListener("pointerup", () => {
      this.clicked = false;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Shift") {
        this.shiftDown = true;
      }
    });
    document.addEventListener("keyup", (event) => {
      if (event.key === "Shift") {
        this.shiftDown = false;
      }
    });
  }

  update(camera: Camera) {
    this.raycaster.setFromCamera(this.screenCursor, camera);
  }

  destroy() {
    document.removeEventListener("pointermove", () => {});
    document.removeEventListener("pointerdown", () => {});
    document.removeEventListener("pointerup", () => {});
    document.removeEventListener("keydown", () => {});
    document.removeEventListener("keyup", () => {});
  }
}
