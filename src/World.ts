import type { Scene, WebGLRenderer, Camera } from "three";
import { type GUI } from "three/addons/libs/lil-gui.module.min.js";
import { type OrbitControls } from "three/addons/controls/OrbitControls.js";

import type Resources from "./Utils/Resources";

export interface WorldOptions {
  time: { elapsedSec: number; deltaSec: number };
  scene: Scene;
  renderer: {
    instance: WebGLRenderer;
    setClearColor: (color: string) => void;
  };
  camera: {
    instance: Camera;
    controls: OrbitControls;
    setFov: (fov: number) => void;
    setPosition: (x: number, y: number, z: number) => void;
    setTarget: (x: number, y: number, z: number) => void;
  };
  sizes: {
    width: number;
    height: number;
    pixelRatio: number;
    pixelResolution: { x: number; y: number };
  };
  resources: Resources;
  debug: { active: boolean; getUI: () => GUI };
}

export class World {
  protected time: WorldOptions["time"];
  protected sizes: WorldOptions["sizes"];
  protected scene: WorldOptions["scene"];
  protected renderer: WorldOptions["renderer"];
  protected camera: WorldOptions["camera"];
  protected resources: WorldOptions["resources"];
  protected debug: WorldOptions["debug"];

  public debugFolder: GUI | null = null;

  constructor(opts: WorldOptions) {
    this.time = opts.time;
    this.sizes = opts.sizes;
    this.scene = opts.scene;
    this.renderer = opts.renderer;
    this.camera = opts.camera;
    this.resources = opts.resources;
    this.debug = opts.debug;

    if (this.debug.active) {
      this.debugFolder = this.debug.getUI().addFolder("world");
    }
  }

  public initialize?(): void;

  public update?(): void;

  public opts(): WorldOptions {
    return {
      time: this.time,
      sizes: this.sizes,
      scene: this.scene,
      renderer: this.renderer,
      camera: this.camera,
      resources: this.resources,
      debug: this.debug,
    };
  }

  public destroy(): void {
    this.debugFolder?.destroy();
  }
}
