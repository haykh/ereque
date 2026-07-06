import { type Scene, PerspectiveCamera } from "three";
import { type GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

interface CameraOptions {
  sizes: {
    width: number;
    height: number;
  };
  canvas: HTMLCanvasElement;
  scene: Scene;
  debug: { active: boolean; getUI: () => GUI };
}

export default class Camera {
  private canvas: HTMLCanvasElement;
  private sizes: { width: number; height: number };
  private scene: Scene;
  public readonly debugFolder: GUI | null = null;

  public instance: PerspectiveCamera;
  public controls: OrbitControls;

  constructor(opts: CameraOptions) {
    this.sizes = opts.sizes;
    this.scene = opts.scene;
    this.canvas = opts.canvas;

    if (opts.debug.active) {
      this.debugFolder = opts.debug.getUI().addFolder("camera");
    }

    // camera
    this.instance = new PerspectiveCamera(
      35,
      this.sizes.width / this.sizes.height,
      0.1,
      1000,
    );
    this.instance.position.set(6, 4, 8);
    this.scene.add(this.instance);

    // controls
    this.controls = new OrbitControls(this.instance, this.canvas);
    this.controls.enableDamping = true;

    this.debugFolder?.add(this.controls, "enabled" as any).name("controls");
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height;
    this.instance.updateProjectionMatrix();
  }

  update() {
    this.controls.update();
  }

  destroy() {
    this.controls.dispose();
  }
}
