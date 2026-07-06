import EventEmitter from "./EventEmitter";

export default class Time extends EventEmitter {
  private active: boolean;
  public readonly start: number;
  public current: number;
  public elapsed: number;
  public delta: number;

  constructor() {
    super();
    this.active = true;

    this.start = Date.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 16;

    window.requestAnimationFrame(() => {
      this.tick();
    });
  }

  tick() {
    const current = Date.now();
    this.delta = current - this.current;
    this.current = current;
    this.elapsed = this.current - this.start;

    this.trigger("tick");

    window.requestAnimationFrame(() => {
      if (this.active) {
        this.tick();
      }
    });
  }

  get elapsedSec() {
    return this.elapsed * 1e-3;
  }

  get deltaSec() {
    return this.delta * 1e-3;
  }

  destroy() {
    this.active = false;
  }
}
