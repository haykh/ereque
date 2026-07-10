import type { Scene, Mesh, Material } from "three";
import {
  BufferGeometry,
  DataTexture,
  RGBAFormat,
  NearestFilter,
  FloatType,
} from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  shaderStructs,
  shaderIntersectFunction,
} from "three-mesh-bvh";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type CustomShaderMaterial from "../../Utils/CustomShaderMaterial";
import {
  GLSLFunction,
  GLSLUniform,
  GLSLStruct,
  GLSLShaderChunk,
} from "../../Utils/ShaderTemplate";
import { GLSLOccludedContract } from "./ShaderContracts";

import bvhPreambleShader from "./shaders/bvh_preamble.glsl";

export interface BVHSceneOptions {
  scene: Scene;
  traceMaterial: CustomShaderMaterial;
  packNormals?: boolean;
}

/**
 * Utility class to build a Bounding Volume Hierarchy (BVH) for a Three.js scene
 * and provide shader functions for ray intersection.
 *
 * Shader provides:
 *
 * - `Hit` struct with `hit`, `t`, `pos`, `n`, `ng`, and `materialId` fields
 * - `Hit intersectScene(origin, dir)` returns the first intersection of a ray with the scene
 * - `bool occluded(origin, dir, maxDist)` returns true if the ray is occluded by any geometry in the scene within `maxDist`
 */
export default class BVHScene {
  private scene: Scene;
  private traceMaterial: CustomShaderMaterial;

  private vertexPayloadTexture: DataTexture | null = null;
  private materialList: Array<Material> = [];

  private packNormals: boolean;

  private dirty = true;

  constructor(opts: BVHSceneOptions) {
    this.scene = opts.scene;
    this.traceMaterial = opts.traceMaterial;
    this.packNormals = opts.packNormals ?? true;

    this.traceMaterial.addUniform("bvh", new MeshBVHUniformStruct(), false);
    this.traceMaterial.addUniform("uVertexPayload", null, false);
  }

  public build(): void {
    this.scene.updateMatrixWorld(true);
    const geoms: BufferGeometry[] = [];
    const matIds: number[] = [];
    const idOf = new Map<Material, number>();

    this.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) {
        return;
      }
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      if (this.packNormals && !g.getAttribute("normal")) {
        g.computeVertexNormals();
      }
      const ni = g.index ? g.toNonIndexed() : g;
      const posOnly = new BufferGeometry();
      posOnly.setAttribute("position", ni.getAttribute("position").clone());
      if (this.packNormals) {
        posOnly.setAttribute("normal", ni.getAttribute("normal").clone());
      }
      geoms.push(posOnly);

      let id = idOf.get(mesh.material as Material);
      if (id === undefined) {
        id = idOf.size;
        idOf.set(mesh.material as Material, id);
        this.materialList[id] = mesh.material as Material;
      }
      const vcount = posOnly.getAttribute("position").count;
      for (let i = 0; i < vcount; i++) {
        matIds.push(id);
      }
    });
    if (geoms.length === 0) {
      return;
    }
    const merged = mergeGeometries(geoms);

    // build material index & normals texture
    const N = matIds.length;
    const W = 2048;
    const H = Math.max(1, Math.ceil(N / W));
    const data = new Float32Array(W * H * 4);

    const nAttr = this.packNormals ? merged.getAttribute("normal") : null;

    for (let i = 0; i < N; i++) {
      if (this.packNormals) {
        data[i * 4 + 0] = nAttr!.getX(i);
        data[i * 4 + 1] = nAttr!.getY(i);
        data[i * 4 + 2] = nAttr!.getZ(i);
      }
      data[i * 4 + 3] = matIds[i]; // material id in .a
    }
    const vertexPayloadTex = new DataTexture(data, W, H, RGBAFormat, FloatType);
    vertexPayloadTex.magFilter = vertexPayloadTex.minFilter = NearestFilter;
    vertexPayloadTex.needsUpdate = true;

    this.vertexPayloadTexture?.dispose();
    this.vertexPayloadTexture = vertexPayloadTex;

    // update shader uniforms
    const u = this.traceMaterial.instance.uniforms;
    u.uVertexPayload.value = this.vertexPayloadTexture;

    (u.bvh.value as MeshBVHUniformStruct).updateFrom(new MeshBVH(merged));
  }

  public getMaterials(): Array<Material> {
    return this.materialList;
  }

  public isDirty(): boolean {
    return this.dirty;
  }

  public markForRebuild(): void {
    this.dirty = true;
  }

  public rebuildIfNecessary(): boolean {
    if (this.dirty) {
      this.build();
      this.dirty = false;
      return true;
    }
    return false;
  }

  public destroy(): void {
    const u = this.traceMaterial.instance.uniforms;
    (u.bvh.value as MeshBVHUniformStruct).dispose();
    this.vertexPayloadTexture?.dispose();
  }

  public static ShaderChunk(smooth_shading?: boolean): GLSLShaderChunk {
    const uniforms = [
      new GLSLUniform("BVH", "bvh"),
      new GLSLUniform("sampler2D", "uVertexPayload"),
    ];

    const structs = [
      new GLSLStruct("Hit", [
        "bool hit",
        "float t",
        "vec3 pos",
        "vec3 n",
        "vec3 ng",
        "int materialId",
      ]),
    ];

    const functions = [
      new GLSLFunction(
        "Hit",
        "intersectScene",
        ["in vec3 origin", "in vec3 dir"],
        [
          "Hit   h;",
          "uvec4 faceIndices;",
          "vec3  faceNormal, bary;",
          "float side, dist;",
          "h.hit = bvhIntersectFirstHit(bvh, origin, dir, faceIndices, faceNormal, bary, side, dist);",
          "if (h.hit) {",
          "  h.t          = dist;",
          "  h.pos        = origin + dist * dir;",
          "  vec3 ng = normalize(faceNormal);",
          "  if (dot(ng, dir) > 0.0) ng = -ng;",
          "  h.ng = ng;",
          ...((smooth_shading ?? true)
            ? [
                "  vec3 n0 = texelFetch1D(uVertexPayload, faceIndices.x).xyz;",
                "  vec3 n1 = texelFetch1D(uVertexPayload, faceIndices.y).xyz;",
                "  vec3 n2 = texelFetch1D(uVertexPayload, faceIndices.z).xyz;",
                "  vec3 ns = normalize(bary.x * n0 + bary.y * n1 + bary.z * n2);",
                "  if (dot(ns, ng) < 0.0) ns = -ns;",
                "  h.n = ns;",
              ]
            : ["  h.n = ng;"]),
          "  h.materialId = int(texelFetch1D(uVertexPayload, faceIndices.x).a + 0.5);",
          "}",
          "return h;",
        ],
      ),
      GLSLOccludedContract.implement("occluded", [
        "return bvhIntersectShadow(bvh, origin, dir, maxDist);",
      ]),
    ];

    return new GLSLShaderChunk(uniforms, [], structs, functions)
      .addPreamble(bvhPreambleShader)
      .bake({ shaderStructs, shaderIntersectFunction });
  }
}
