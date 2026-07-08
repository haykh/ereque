import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import type { RendererPipeline, RendererPipelineOptions } from "ereque";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import { World } from "../World";
import type { WorldOptions } from "../World";
import CustomShaderMaterial from "../Utils/CustomShaderMaterial";

import vertexShader from "./shaders/renderer/custom/shader.vert";
import fragmentShader from "./shaders/renderer/custom/shader.frag";

/*
 * Example with custom renderer pipeline
 */

export default class Example extends World {
  constructor(opts: WorldOptions) {
    super(opts);
  }

  protected override initialize() {}

  public override update() {}

  destroy() {
    super.destroy();
  }
}

export class CustomRendererPipeline implements RendererPipeline {
  private opts: RendererPipelineOptions;
  private material: CustomShaderMaterial;
  private quad: FullScreenQuad;

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    this.opts = opts;
    this.material = new CustomShaderMaterial("shader material", {
      vertexShader,
      fragmentShader,
      ...this.opts,
    });

    this.quad = new FullScreenQuad(this.material.instance);
  }

  render(time?: { elapsedSec: number }): void {
    this.material.update(time ?? { elapsedSec: 0 });
    this.opts.renderer.setRenderTarget(null);
    this.quad.render(this.opts.renderer);
  }

  resize(): void {
    this.opts.renderer.setSize(this.opts.sizes.width, this.opts.sizes.height);
    this.opts.renderer.setPixelRatio(this.opts.sizes.pixelRatio);
  }

  destroy(): void {
    this.quad.dispose();
    this.material.destroy();
  }
}
