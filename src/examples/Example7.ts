import {
  Mesh,
  BoxGeometry,
  TorusKnotGeometry,
  MeshStandardMaterial,
} from "three";
import type { DataTexture } from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import {
  glsl,
  World,
  ProgressiveAccumulator,
  BVHScene,
  CustomShaderLights,
  MaterialLibrary,
  EnvironmentMap,
} from "ereque";
import type {
  MaterialModel,
  WorldOptions,
  RendererPipeline,
  RendererPipelineOptions,
} from "ereque";

import sceneShaderBody from "./shaders/example7/scene.glsl";

/*
 * Example with custom renderer pipeline & complex scene with refraction and reflection.
 */

export default class Example extends World {
  constructor(opts: WorldOptions) {
    super(opts);
    opts.camera.controls.enableDamping = false;
  }

  public override initialize(): void {
    const glassMat = new MeshStandardMaterial({ color: 0xffffff });
    glassMat.userData.model = "glass";
    glassMat.userData.ior = 1.5;

    const sphere = new Mesh(new TorusKnotGeometry(1, 0.4, 128, 32), glassMat);
    this.scene.add(sphere);

    const plane = new Mesh(
      new BoxGeometry(10, 0.1, 10),
      new MeshStandardMaterial({ color: 0x2a2a2a }),
    );
    plane.position.set(0, -2, 0);
    this.scene.add(plane);
  }

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

  private bvh_scene: BVHScene;
  private lights: CustomShaderLights;
  private materials: MaterialLibrary;
  private envMap: EnvironmentMap;

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    const models: MaterialModel[] = [
      {
        name: "glass",
        scatter: [
          glsl`
          pdf = -1.0;
          float schlick_R0 = pow((1.0 - mat.ior) / (1.0 + mat.ior), 2.0);
          float schlick_R = schlick_R0 + (1.0 - schlick_R0) * pow(1.0 - abs(dot(wo, n)), 5.0);
          if (rand(rng) < schlick_R) {
            wi = reflect(-wo, n);
            weight   = mat.albedo;
            emission = vec3(0.0);
            return true;
          }
          float eta = isFrontFace ? (1.0 / mat.ior) : mat.ior;
          vec3  I   = -wo;
          vec3  r   = refract(I, n, eta);
          if (dot(r, r) == 0.0) {
            wi = reflect(I, n);
          } else {
            wi = r;
          }
          weight   = mat.albedo;
          emission = vec3(0.0);
          pdf = -1.0;
          return true;`,
        ],
        eval: ["return vec3(0.0);"],
        pdf: ["return 0.0;"],
      },
    ];

    const sceneShader = BVHScene.ShaderChunk(true)
      .merge(MaterialLibrary.ShaderChunk(models))
      .merge(CustomShaderLights.ShaderChunk())
      .merge(EnvironmentMap.ShaderChunk())
      .addPostamble(sceneShaderBody)
      .render();

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
    this.materials = new MaterialLibrary({
      traceMaterial: this.traceMaterial,
      models,
    });
    this.envMap = new EnvironmentMap({
      traceMaterial: this.traceMaterial,
    });
  }

  public override initialize(): void {
    const exr = this.resources.items["envMap"] as DataTexture | undefined;
    if (!exr) {
      return;
    }
    this.envMap.setTexture(exr);
    this.markForRedraw();
  }

  public override render(time?: { elapsedSec: number }): void {
    const bvhRebuilt = this.bvh_scene.rebuildIfNecessary();
    if (bvhRebuilt) {
      this.materials.build(this.bvh_scene.getMaterials());
    }
    const lightsRebuilt = this.lights.rebuildIfNecessary();
    if (bvhRebuilt || lightsRebuilt) {
      this.markForRedraw();
    }
    super.render(time);
  }

  public override destroy(): void {
    this.bvh_scene.destroy();
    this.materials.destroy();
    this.envMap.destroy();
    super.destroy();
  }
}
