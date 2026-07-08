import {
  Mesh,
  BufferGeometry,
  BoxGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
} from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  shaderStructs,
  shaderIntersectFunction,
} from "three-mesh-bvh";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import { World, ProgressiveAccumulator } from "ereque";
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

  private bvhBuilt = false;

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    const sceneShader = `
      precision highp isampler2D;
      precision highp usampler2D;
      ${shaderStructs}
      ${shaderIntersectFunction}
      ${sceneShaderBody}
    `;
    super({ ...opts, sceneShader });
    this.scene = opts.scene;

    this.traceMaterial.addUniform("bvh", new MeshBVHUniformStruct(), false);
  }

  private buildBVH(): void {
    this.scene.updateMatrixWorld(true);
    const geoms: BufferGeometry[] = [];

    this.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld); // bake into world space
      const ni = g.index ? g.toNonIndexed() : g; // normalize for merging
      const posOnly = new BufferGeometry(); // position-only -> always mergeable
      posOnly.setAttribute("position", ni.getAttribute("position").clone());
      geoms.push(posOnly);
    });
    if (geoms.length === 0) return;

    const merged = mergeGeometries(geoms); // one world-space geometry
    const bvh = new MeshBVH(merged); // MeshBVH adds/reorders the index for you

    (
      this.traceMaterial.instance.uniforms.bvh.value as MeshBVHUniformStruct
    ).updateFrom(bvh);
  }

  protected markGeometryForRebuild(): void {
    this.bvhBuilt = false;
    super.markForRedraw();
  }

  render(time?: { elapsedSec: number }): void {
    if (!this.bvhBuilt) {
      this.buildBVH();
      this.bvhBuilt = true;
      super.markForRedraw();
    }
    super.render(time);
  }

  resize(): void {
    super.resize();
  }

  destroy(): void {
    (
      this.traceMaterial.instance.uniforms.bvh.value as MeshBVHUniformStruct
    ).dispose();

    super.destroy();
  }
}
