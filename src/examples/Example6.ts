import {
  Mesh,
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
    const mesh = new Mesh(
      new IcosahedronGeometry(1, 1),
      new MeshBasicMaterial(),
    );
    this.scene.add(mesh);
  }

  public override update() {}

  destroy() {
    super.destroy();
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
    this.traceMaterial.addUniform("uTrianglesWidth", 1, false);
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
    const width = Math.max(1, numVerts); // 1 texel per vertex, single row
    const data = new Float32Array(width * 4); // RGBA float; xyz in rgb
    for (let i = 0; i < numVerts; i++) {
      data[i * 4 + 0] = flat[i * 3 + 0];
      data[i * 4 + 1] = flat[i * 3 + 1];
      data[i * 4 + 2] = flat[i * 3 + 2];
      data[i * 4 + 3] = 1.0;
    }

    const tex = new DataTexture(data, width, 1, RGBAFormat, FloatType);
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.needsUpdate = true;

    this.triangleTexture?.dispose();
    this.triangleTexture = tex;

    const u = this.traceMaterial.instance.uniforms;
    u.uTriangles.value = tex;
    u.uNumTriangles.value = Math.floor(numVerts / 3);
    u.uTrianglesWidth.value = width;
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
