import {
  Mesh,
  DirectionalLight,
  BoxGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
  PointLight,
  AmbientLight,
} from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import {
  World,
  ProgressiveAccumulator,
  BVHScene,
  prependBVHScenePreamble,
  CustomShaderLights,
  prependCustomShaderLightsPreamble,
} from "ereque";
import type {
  WorldOptions,
  RendererPipeline,
  RendererPipelineOptions,
} from "ereque";

import sceneShaderBody from "./shaders/renderer/custom/scene.glsl";

/*
 * Example with custom renderer pipeline
 */

export default class Example extends World {
  constructor(opts: WorldOptions) {
    super(opts);
    opts.camera.controls.enableDamping = false;

    const key = new DirectionalLight(0xff0000, 1.0);
    key.position.set(5, 8, 3);
    this.scene.add(key);

    const point = new PointLight(0x00ff00, 1.0);
    point.position.set(-5, 8, -3);
    this.scene.add(point);

    const ambient = new AmbientLight(0x0000ff, 0.5);
    this.scene.add(ambient);
  }

  protected override initialize() {
    const sphere = new Mesh(
      new IcosahedronGeometry(1, 3),
      new MeshBasicMaterial(),
    );
    sphere.position.y = 1.0;
    this.scene.add(sphere);

    const floor = new Mesh(
      new BoxGeometry(12, 0.1, 12),
      new MeshBasicMaterial(),
    );
    this.scene.add(floor);
  }

  public override update() {}

  destroy() {
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
  private bvh_scene: BVHScene;
  private lights: CustomShaderLights;

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    const sceneShader = prependBVHScenePreamble(
      prependCustomShaderLightsPreamble(sceneShaderBody),
    );
    super({ ...opts, sceneShader });
    this.scene = opts.scene;
    this.bvh_scene = new BVHScene({
      scene: this.scene,
      traceMaterial: this.traceMaterial,
    });
    this.lights = new CustomShaderLights({
      scene: this.scene,
      traceMaterial: this.traceMaterial,
    });
  }

  render(time?: { elapsedSec: number }): void {
    if (
      this.bvh_scene.rebuildIfNecessary() ||
      this.lights.rebuildIfNecessary()
    ) {
      super.markForRedraw();
    }
    super.render(time);
  }

  resize(): void {
    super.resize();
  }

  destroy(): void {
    this.bvh_scene.destroy();
    super.destroy();
  }
}
