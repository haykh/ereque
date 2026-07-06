import { Vector2 } from "three";
import EventEmitter from "./EventEmitter";

export default class Sizes extends EventEmitter {
  public width: number;
  public height: number;
  public pixelRatio: number;
  public pixelResolution: Vector2;

  constructor() {
    super();

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(2, window.devicePixelRatio);
    this.pixelResolution = new Vector2(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
    );

    window.addEventListener("resize", () => {
      this.resize();
    });
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(2, window.devicePixelRatio);
    this.pixelResolution.set(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
    );

    this.trigger("resize");
  }

  destroy() {
    window.removeEventListener("resize", () => {
      this.resize();
    });
  }
}
