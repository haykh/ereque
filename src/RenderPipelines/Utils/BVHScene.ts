import type { Scene, Mesh, Material } from "three";
import {
  BufferAttribute,
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
import { SceneMeshSignature } from "../../Utils/SceneSignatures";

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
 * - `struct Hit`
 *   * `bool isHit`: whether the ray hit any geometry
 *   * `float distance`: distance from ray origin to intersection point
 *   * `vec3 position`: world-space position of the intersection
 *   * `vec3 shadowPosition`: terminator-safe ray origin for shadow rays
 *   * `vec3 smoothNormal`: interpolated normal at the intersection point
 *   * `vec3 geometricNormal`: face normal of the intersected triangle
 *   * `int materialId`: index of the material associated with the intersected geometry
 *
 * - `Hit intersectScene(origin, dir)`
 *   * `vec3 origin`: ray origin in world space
 *   * `vec3 dir`: ray direction in world space
 *   * returns the first intersection of a ray with the scene
 *
 * - `bool occluded(origin, dir, maxDist)`
 *   * `vec3 origin`: ray origin in world space
 *   * `vec3 dir`: ray direction in world space
 *   * `float maxDist`: maximum distance to check for occlusion
 *   * returns true if the ray is occluded by any geometry in the scene within `maxDist`
 */
export default class BVHScene {
  private scene: Scene;
  private traceMaterial: CustomShaderMaterial;

  private vertexPayloadTexture: DataTexture | null = null;
  private materialList: Array<Material> = [];

  private packNormals: boolean;

  private lastSceneMeshSignature: string = "";
  private dirty = true;

  constructor(opts: BVHSceneOptions) {
    this.scene = opts.scene;
    this.traceMaterial = opts.traceMaterial;
    this.packNormals = opts.packNormals ?? true;

    this.traceMaterial.addUniform("bvh", new MeshBVHUniformStruct(), false);
    this.traceMaterial.addUniform("uVertexPayload", null, false);

    this.seedEmptyBVHScene();
  }

  private build(): void {
    const geoms: BufferGeometry[] = [];
    const matIds: number[] = [];
    const idOf = new Map<Material, number>();
    this.materialList = [];

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
      this.seedEmptyBVHScene();
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

  private seedEmptyBVHScene(): void {
    const dummy = new BufferGeometry();
    dummy.setAttribute("position", new BufferAttribute(new Float32Array(9), 3));
    (
      this.traceMaterial.instance.uniforms.bvh.value as MeshBVHUniformStruct
    ).updateFrom(new MeshBVH(dummy));
    this.vertexPayloadTexture?.dispose();
    this.vertexPayloadTexture = null;
    this.traceMaterial.instance.uniforms.uVertexPayload.value = null;
    this.materialList = [];
  }

  public rebuildIfNecessary(): boolean {
    this.scene.updateMatrixWorld(true);
    const sig = SceneMeshSignature(this.scene);
    if (sig === this.lastSceneMeshSignature && !this.dirty) {
      return false;
    }
    this.lastSceneMeshSignature = sig;
    this.build();
    this.dirty = false;
    return true;
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
        "bool isHit",
        "float distance",
        "vec3 position",
        "vec3 shadowPosition",
        "vec3 smoothNormal",
        "vec3 geometricNormal",
        "bool isFrontFace",
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
          "h.isHit = bvhIntersectFirstHit(bvh, origin, dir, faceIndices, faceNormal, bary, side, dist);",
          "if (h.isHit) {",
          "  h.distance = dist;",
          "  h.position = origin + dist * dir;",
          "  h.geometricNormal = normalize(faceNormal);",
          "  h.isFrontFace = side > 0.0;",
          ...((smooth_shading ?? true)
            ? [
                "  vec3 n0 = texelFetch1D(uVertexPayload, faceIndices.x).xyz;",
                "  vec3 n1 = texelFetch1D(uVertexPayload, faceIndices.y).xyz;",
                "  vec3 n2 = texelFetch1D(uVertexPayload, faceIndices.z).xyz;",
                "  vec3 p0 = texelFetch1D(bvh.position, faceIndices.x).xyz;",
                "  vec3 p1 = texelFetch1D(bvh.position, faceIndices.y).xyz;",
                "  vec3 p2 = texelFetch1D(bvh.position, faceIndices.z).xyz;",
                "  h.shadowPosition = h.position",
                "    - bary.x * min(0.0, dot(h.position - p0, n0)) * n0",
                "    - bary.y * min(0.0, dot(h.position - p1, n1)) * n1",
                "    - bary.z * min(0.0, dot(h.position - p2, n2)) * n2;",
                "  vec3 ns = normalize(bary.x * n0 + bary.y * n1 + bary.z * n2);",
                "  if (dot(ns, h.geometricNormal) < 0.0) ns = -ns;",
                "  h.smoothNormal = ns;",
              ]
            : [
                "  h.shadowPosition = h.position;",
                "  h.smoothNormal = h.geometricNormal;",
              ]),
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
