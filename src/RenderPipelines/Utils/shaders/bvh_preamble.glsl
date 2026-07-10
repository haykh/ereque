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
