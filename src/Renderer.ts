import type { Scene, Camera } from "three";
import { WebGLRenderer, Color } from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import type {
  RendererPipeline,
  RendererPipelineOptions,
  RendererPipelineFactory,
} from "./Utils/RendererPipeline";

interface RendererOptions<P extends RendererPipeline> {
  canvas: HTMLCanvasElement;
  sizes: RendererPipelineOptions["sizes"];
  resources: RendererPipelineOptions["resources"];
  scene: Scene;
  camera: { instance: Camera };
  debug: { active: boolean; getUI: () => GUI };
  pipeline: RendererPipelineFactory<P>;
}

export default class Renderer<P extends RendererPipeline = RendererPipeline> {
  private canvas: HTMLCanvasElement;
  private params = {
    clearColor: "#1a1a1a",
  };

  public instance: WebGLRenderer;
  public readonly pipeline: P;
  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererOptions<P>) {
    this.canvas = opts.canvas;
    this.instance = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.instance.setClearColor(this.params.clearColor);

    this.pipeline = opts.pipeline({
      ...opts,
      renderer: this.instance,
      camera: opts.camera.instance,
    });

    if (opts.debug.active) {
      this.debugFolder = opts.debug.getUI().addFolder("renderer");
    }

    this.debugFolder
      ?.addColor(this.params, "clearColor")
      .onChange(() => {
        this.instance.setClearColor(new Color(this.params.clearColor));
      })
      .listen();

    this.resize();
  }

  public initialize(): void {
    this.pipeline.initialize?.();
  }

  public setClearColor(color: string): void {
    this.params.clearColor = color;
    this.instance.setClearColor(this.params.clearColor);
  }

  public resize(): void {
    this.pipeline.resize?.();
  }

  public update(time: { elapsedSec: number; deltaSec: number }): void {
    this.pipeline.render(time);
  }

  public destroy(): void {
    this.debugFolder?.destroy();
    this.pipeline.destroy?.();
    this.instance.dispose();
  }
}
