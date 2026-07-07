import type { Scene, Camera } from "three";
import { WebGLRenderer, Color } from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

interface RendererOptions {
  canvas: HTMLCanvasElement;
  sizes: { width: number; height: number; pixelRatio: number };
  scene: Scene;
  camera: { instance: Camera };
  debug: { active: boolean; getUI: () => GUI };
}

export default class Renderer {
  private canvas: HTMLCanvasElement;
  private sizes: { width: number; height: number; pixelRatio: number };
  private scene: Scene;
  private camera: Camera;

  public instance: WebGLRenderer;
  public debugFolder: GUI | null = null;

  private params = {
    clearColor: "#1a1a1a",
  };

  constructor(opts: RendererOptions) {
    this.canvas = opts.canvas;
    this.sizes = opts.sizes;
    this.scene = opts.scene;
    this.camera = opts.camera.instance;
    if (opts.debug.active) {
      this.debugFolder = opts.debug.getUI().addFolder("renderer");
    }

    this.instance = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    // this.instance.toneMapping = THREE.CineonToneMapping;
    // this.instance.toneMappingExposure = 1.75;
    // this.instance.shadowMap.enabled = true;
    // this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.setClearColor(this.params.clearColor);

    this.debugFolder
      ?.addColor(this.params, "clearColor")
      .onChange(() => {
        this.instance.setClearColor(new Color(this.params.clearColor));
      })
      .listen();

    this.resize();
  }

  public setClearColor(color: string) {
    this.params.clearColor = color;
    this.instance.setClearColor(this.params.clearColor);
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  update() {
    this.instance.render(this.scene, this.camera);
  }

  destroy() {
    this.instance.dispose();
  }
}
