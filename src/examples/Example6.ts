import {
  Mesh,
  Color,
  DirectionalLight,
  BoxGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  PointLight,
  AmbientLight,
} from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import {
  World,
  ProgressiveAccumulator,
  BVHScene,
  CustomShaderLights,
  MaterialLibrary,
} from "ereque";
import type {
  MaterialModel,
  WorldOptions,
  RendererPipeline,
  RendererPipelineOptions,
} from "ereque";

import sceneShaderBody from "./shaders/example6/scene.glsl";

/*
 * Example with custom renderer pipeline
 */

export default class Example extends World {
  constructor(opts: WorldOptions) {
    super(opts);
    opts.camera.controls.enableDamping = false;
  }

  public override initialize(): void {
    // meshes
    const sphere = new Mesh(
      new IcosahedronGeometry(1, 3),
      new MeshStandardMaterial({
        color: 0xcc4433,
        emissive: 0xff0000,
        emissiveIntensity: 20.0,
      }),
    );
    sphere.position.y = 1.0;
    this.scene.add(sphere);
    this.renderer.setClearColor("#f2f2f2");

    const mirrorMat = new MeshStandardMaterial({ color: 0xffffff });
    mirrorMat.userData.model = "mirror";
    const ball = new Mesh(new BoxGeometry(1, 1, 1), mirrorMat);
    ball.position.set(0, 1, -3);
    ball.rotation.set(0, 0.2, 0);
    this.scene.add(ball);

    const floor = new Mesh(
      new BoxGeometry(12, 0.1, 12),
      new MeshStandardMaterial({ color: 0x222222 }),
    );
    this.scene.add(floor);

    // lights
    const key = new DirectionalLight(0xff0000, 1.0);
    key.position.set(5, 8, 3);
    this.scene.add(key);

    const point = new PointLight(0x00ff00, 1.0);
    point.position.set(-5, 8, -3);
    this.scene.add(point);

    const ambient = new AmbientLight(0x0000ff, 0.5);
    this.scene.add(ambient);
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

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    const models: MaterialModel[] = [
      {
        name: "mirror",
        scatter: [
          "emission = vec3(0.0);",
          "wi       = reflect(-wo, n);",
          "weight   = mat.albedo;",
          "return true;",
        ],
        eval: "return vec3(0.0);",
      },
    ];

    const sceneShader = BVHScene.ShaderChunk(false)
      .merge(MaterialLibrary.ShaderChunk(models))
      .merge(CustomShaderLights.ShaderChunk())
      .addPostamble(sceneShaderBody)
      .addUniform("vec3 uClearColor")
      .render();

    super({ ...opts, sceneShader });
    this.scene = opts.scene;
    this.bvh_scene = new BVHScene({
      scene: this.scene,
      traceMaterial: this.traceMaterial,
      packNormals: false,
    });
    this.lights = new CustomShaderLights({
      scene: this.scene,
      traceMaterial: this.traceMaterial,
    });
    this.materials = new MaterialLibrary({
      traceMaterial: this.traceMaterial,
      models,
    });
    this.traceMaterial.addColorUniform(
      "uClearColor",
      this.renderer.getClearColor(new Color()).getHexString(),
      false,
    );
  }

  render(time?: { elapsedSec: number }): void {
    const bvhRebuilt = this.bvh_scene.rebuildIfNecessary();
    if (bvhRebuilt) {
      this.materials.build(this.bvh_scene.getMaterials());
    }
    const lightsRebuilt = this.lights.rebuildIfNecessary();
    if (bvhRebuilt || lightsRebuilt) {
      super.markForRedraw();
    }
    this.traceMaterial.instance.uniforms.uClearColor.value.set(
      this.renderer.getClearColor(new Color()),
    );
    super.render(time);
  }

  resize(): void {
    super.resize();
  }

  destroy(): void {
    this.bvh_scene.destroy();
    this.materials.destroy();
    super.destroy();
  }
}
