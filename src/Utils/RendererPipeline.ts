import type { Scene, Camera, WebGLRenderer } from "three";

export interface RendererPipelineOptions {
  renderer: WebGLRenderer;
  sizes: { width: number; height: number; pixelRatio: number };
  scene: Scene;
  camera: Camera;
}

export interface RendererPipeline {
  render(time?: { elapsedSec: number; deltaSec: number }): void;
  resize?(): void;
  destroy?(): void;
}

export type RendererPipelineFactory<
  P extends RendererPipeline = RendererPipeline,
> = (opts: RendererPipelineOptions) => P;

export default class DefaultRendererPipeline implements RendererPipeline {
  private renderer: WebGLRenderer;
  private sizes: { width: number; height: number; pixelRatio: number };
  private scene: Scene;
  private camera: Camera;

  constructor(opts: RendererPipelineOptions) {
    this.renderer = opts.renderer;
    this.sizes = opts.sizes;
    this.scene = opts.scene;
    this.camera = opts.camera;

    // this.renderer.toneMapping = THREE.CineonToneMapping;
    // this.renderer.toneMappingExposure = 1.75;
    // this.renderer.shadowMap.enabled = true;
    // this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public resize(): void {
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
  }
}
