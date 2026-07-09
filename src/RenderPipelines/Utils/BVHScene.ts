import type { Scene, Mesh } from "three";
import { BufferGeometry } from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  shaderStructs,
  shaderIntersectFunction,
} from "three-mesh-bvh";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type CustomShaderMaterial from "../../Utils/CustomShaderMaterial";
import { glsl } from "../../glsl";

export interface BVHSceneOptions {
  scene: Scene;
  traceMaterial: CustomShaderMaterial;
}

/**
 * Utility class to build a Bounding Volume Hierarchy (BVH) for a Three.js scene
 * and provide shader functions for ray intersection.
 *
 * Shader provides:
 *
 * - `Hit` struct with `hit`, `t`, `pos`, and `n` fields
 * - `Hit intersectScene(origin, dir)` returns the first intersection of a ray with the scene
 * - `bool occluded(origin, dir, maxDist)` returns true if the ray is occluded by any geometry in the scene within `maxDist`
 */
export default class BVHScene {
  private scene: Scene;
  private traceMaterial: CustomShaderMaterial;

  private dirty = true;

  constructor(opts: BVHSceneOptions) {
    this.scene = opts.scene;
    this.traceMaterial = opts.traceMaterial;

    this.traceMaterial.addUniform("bvh", new MeshBVHUniformStruct(), false);
  }

  public build(): void {
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
    (
      this.traceMaterial.instance.uniforms.bvh.value as MeshBVHUniformStruct
    ).dispose();
  }
}

const PREAMBLE = glsl`
precision highp isampler2D;
precision highp usampler2D;
${shaderStructs}
${shaderIntersectFunction}


#define bvhIntersectShadow(bvh, rayOrigin, rayDirection, maxDist)              \
  _bvhIntersectShadow(bvh.position,                                            \
                      bvh.index,                                               \
                      bvh.bvhBounds,                                           \
                      bvh.bvhContents,                                         \
                      rayOrigin,                                               \
                      rayDirection,                                            \
                      maxDist)

// Any-hit / shadow traversal: returns true on the FIRST triangle hit within
// (eps, maxDist) and stops. Mirrors _bvhIntersectFirstHit from three-mesh-bvh,
// minus closest-hit tracking. Coupled to this three-mesh-bvh version's node layout.
bool _bvhIntersectShadow(sampler2D  bvh_position,
                         usampler2D bvh_index,
                         sampler2D  bvh_bvhBounds,
                         usampler2D bvh_bvhContents,
                         vec3       rayOrigin,
                         vec3       rayDirection,
                         float      maxDist) {
  int  pointer = 0;
  uint stack[BVH_STACK_DEPTH];
  stack[0] = 0u;

  while (pointer > -1 && pointer < BVH_STACK_DEPTH) {
    uint currNodeIndex = stack[pointer];
    pointer--;

    float boundsHitDistance;
    if (!intersectsBVHNodeBounds(rayOrigin,
                                 rayDirection,
                                 bvh_bvhBounds,
                                 currNodeIndex,
                                 boundsHitDistance) ||
        boundsHitDistance > maxDist // prune nodes past the light
    ) {
      continue;
    }

    uvec2 boundsInfo = uTexelFetch1D(bvh_bvhContents, currNodeIndex).xy;
    bool  isLeaf     = bool(boundsInfo.x & 0xffff0000u);

    if (isLeaf) {
      uint count  = boundsInfo.x & 0x0000ffffu;
      uint offset = boundsInfo.y;
      for (uint i = offset, l = offset + count; i < l; i++) {
        uvec3 indices = uTexelFetch1D(bvh_index, i).xyz;
        vec3  a       = texelFetch1D(bvh_position, indices.x).rgb;
        vec3  b       = texelFetch1D(bvh_position, indices.y).rgb;
        vec3  c       = texelFetch1D(bvh_position, indices.z).rgb;
        vec3  bary, norm;
        float d, s;
        if (intersectsTriangle(rayOrigin, rayDirection, a, b, c, bary, norm, d, s) &&
            d > 1e-4 && d < maxDist) {
          return true; // occluded — stop immediately
        }
      }
    } else {
      uint leftIndex   = currNodeIndex + 1u;
      uint splitAxis   = boundsInfo.x & 0x0000ffffu;
      uint rightIndex  = currNodeIndex + boundsInfo.y;
      bool leftToRight = rayDirection[splitAxis] >= 0.0;
      pointer++;
      stack[pointer] = leftToRight ? rightIndex : leftIndex;
      pointer++;
      stack[pointer] = leftToRight ? leftIndex : rightIndex;
    }
  }
  return false;
}

uniform BVH bvh;

struct Hit {
  bool  hit;
  float t;
  vec3  pos;
  vec3  n;
};

Hit intersectScene(in vec3 origin, in vec3 dir) {
  Hit   h;
  uvec4 faceIndices;
  vec3  faceNormal, bary;
  float side, dist;
  h.hit = bvhIntersectFirstHit(bvh,
                               origin,
                               dir,
                               faceIndices,
                               faceNormal,
                               bary,
                               side,
                               dist);
  if (h.hit) {
    h.t   = dist;
    h.pos = origin + dist * dir;
    h.n   = faceNormal;
  }
  return h;
}

bool occluded(in vec3 origin, in vec3 dir, in float maxDist) {
  return bvhIntersectShadow(bvh, origin, dir, maxDist);
}
`;

export const prependBVHScenePreamble = (sceneShaderBody: string) => glsl`
${PREAMBLE}
${sceneShaderBody}
`;
