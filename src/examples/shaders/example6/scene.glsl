const int MAX_BOUNCES = 10;

vec3 skyColor(vec3 dir) {
  return uClearColor;
}

vec3 sampleRadiance(in vec3 rayOrigin, in vec3 rayDir, inout uint rng) {
  vec3 radiance         = vec3(0.0);
  vec3 throughput       = vec3(1.0);
  vec3 rayOriginCurrent = rayOrigin;
  vec3 rayDirCurrent    = rayDir;
  for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    Hit h = intersectScene(rayOriginCurrent, rayDirCurrent);
    if (!h.isHit) {
      radiance += throughput * skyColor(rayDirCurrent);
      break;
    }

    Material mat = getMaterial(h.materialId);
    vec3     wo  = -rayDirCurrent;
    vec3     wi, weight, emission;
    bool     cont = ${scatter_call};

    radiance += throughput * emission;
    radiance += throughput * ${direct_lighting_call};

    if (!cont) {
      break;
    }
    throughput       *= weight;
    rayOriginCurrent  = h.position + sign(dot(wi, h.geometricNormal)) *
                                      h.geometricNormal * 1e-3;
    rayDirCurrent = wi;
  }

  return radiance;
}
