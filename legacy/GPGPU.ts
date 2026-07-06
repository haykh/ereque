import { type WebGLRenderer } from "three";
import {
  GPUComputationRenderer,
  type Variable,
} from "three/examples/jsm/misc/GPUComputationRenderer";
import type Time from "./Time";
import { DebugQuad } from "./Debug";

export default class GPGPU {
  instance: GPUComputationRenderer;
  textureSize: number;
  debugQuad: DebugQuad | null = null;

  constructor(count: number, renderer: WebGLRenderer) {
    this.textureSize = Math.ceil(Math.sqrt(count));

    this.instance = new GPUComputationRenderer(
      this.textureSize,
      this.textureSize,
      renderer,
    );

    this.debugQuad = new DebugQuad(renderer);
  }

  init() {
    this.instance.init();
  }

  update(_?: Time) {
    this.instance.compute();
  }

  renderDebugQuad(variable: Variable) {
    this.debugQuad?.setTexture(
      this.instance.getCurrentRenderTarget(variable).texture,
    );
    this.debugQuad?.render();
  }

  destroy() {
    this.instance.dispose();
  }
}
