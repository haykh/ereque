import {
  Mesh,
  BoxGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
  FloatType,
  NearestFilter,
  Vector3,
  DataTexture,
  RGBAFormat,
} from "three";
import type { BufferGeometry } from "three";
import type { GUI } from "three/addons/libs/lil-gui.module.min.js";

import { World, ProgressiveAccumulator } from "ereque";
import type {
  WorldOptions,
  RendererPipeline,
  RendererPipelineOptions,
} from "ereque";

import sceneShader from "./shaders/renderer/custom/scene.glsl";

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
    sphere.position.y = 1.0; // resting on the floor
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

  // mesh triangulation
  private trianglesBuilt = false;
  private triangleTexture: DataTexture | null = null;

  public readonly debugFolder: GUI | null = null;

  constructor(opts: RendererPipelineOptions) {
    super({ ...opts, sceneShader });
    this.scene = opts.scene;

    this.traceMaterial.addUniform("uTriangles", null, false);
    this.traceMaterial.addUniform("uNumTriangles", 0, false);
    this.traceMaterial.addUniform("uTexWidth", 1, false);
  }

  private buildTriangles(): void {
    this.scene.updateMatrixWorld(true);
    const flat: number[] = [];
    const v = new Vector3();

    this.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return; // skip camera, lights, etc.
      const geom = mesh.geometry as BufferGeometry;
      const pos = geom.getAttribute("position");
      const index = geom.getIndex();
      const count = index ? index.count : pos.count; // vertices to emit (mult. of 3)
      for (let i = 0; i < count; i++) {
        const vi = index ? index.getX(i) : i;
        v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
        flat.push(v.x, v.y, v.z);
      }
    });

    const numVerts = flat.length / 3; // = 3 * numTriangles
    const wrap_width = 2048;
    const height = Math.max(1, Math.ceil(numVerts / wrap_width));

    const data = new Float32Array(wrap_width * height * 4); // RGBA float; xyz in rgb
    for (let i = 0; i < numVerts; i++) {
      data[i * 4 + 0] = flat[i * 3 + 0];
      data[i * 4 + 1] = flat[i * 3 + 1];
      data[i * 4 + 2] = flat[i * 3 + 2];
      data[i * 4 + 3] = 1.0;
    }

    const tex = new DataTexture(
      data,
      wrap_width,
      height,
      RGBAFormat,
      FloatType,
    );

    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.needsUpdate = true;

    this.triangleTexture?.dispose();
    this.triangleTexture = tex;

    const u = this.traceMaterial.instance.uniforms;
    u.uTriangles.value = tex;
    u.uNumTriangles.value = Math.floor(numVerts / 3);
    u.uTexWidth.value = wrap_width;
  }

  protected markForRebuild(): void {
    super.markForRebuild();
    this.trianglesBuilt = false;
  }

  render(time?: { elapsedSec: number }): void {
    if (!this.trianglesBuilt) {
      this.buildTriangles();
      this.trianglesBuilt = true;
      this.frame = 1;
    }
    super.render(time);
  }

  resize(): void {
    super.resize();
  }

  destroy(): void {
    this.triangleTexture?.dispose();

    super.destroy();
  }
}
