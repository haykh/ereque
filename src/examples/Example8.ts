import { Mesh } from "three";
import type { DataTexture } from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import { World, ProgressiveAccumulator, EnvironmentMap } from "ereque";
import type {
  WorldOptions,
  RendererPipeline,
  RendererPipelineOptions,
} from "ereque";

import sceneShaderBody from "./shaders/example8/scene.glsl";

/*
 * Example with custom renderer pipeline & complex scene with refraction and reflection.
 */

export default class Example extends World {
  constructor(opts: WorldOptions) {
    super(opts);
    opts.camera.controls.enableDamping = false;
  }

  public override initialize(): void {}

  public override destroy(): void {
    super.destroy();
    for (const child of this.scene.children) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const mat of child.material) {
            mat.dispose();
          }
        } else {
          child.material.dispose();
        }
      }
    }
  }
}

export class CustomRendererPipeline
  extends ProgressiveAccumulator
  implements RendererPipeline
{
  private scene: RendererPipelineOptions["scene"];
  private envMap: EnvironmentMap;

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    const sceneShader = EnvironmentMap.ShaderChunk()
      .addPostamble(sceneShaderBody)
      .render();
    super({ ...opts, sceneShader });
    this.scene = opts.scene;
    this.envMap = new EnvironmentMap({
      traceMaterial: this.traceMaterial,
    });
  }

  public initialize(): void {
    const exr = this.resources.items["envMap"] as DataTexture | undefined;
    if (!exr) {
      return;
    }
    this.envMap.setTexture(exr);
    this.envMap.setIntensity(6.0);
  }

  public override render(time?: { elapsedSec: number }): void {
    super.render(time);
  }

  public override destroy(): void {
    this.envMap.destroy();
    super.destroy();
  }
}
