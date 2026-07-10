const int MAX_BOUNCES = 6;

vec3 skyColor(vec3 dir) {
  return vec3(0.0);
  // return mix(vec3(0.8, 0.8, 0.9), vec3(0.2, 0.3, 0.7), dir.y * 0.5 + 0.5) * 1.6;
}

vec3 sampleRadiance(in vec3 rayOrigin, in vec3 rayDir, inout uint rng) {
  vec3 radiance         = vec3(0.0);
  vec3 throughput       = vec3(1.0);
  vec3 rayOriginCurrent = rayOrigin;
  vec3 rayDirCurrent    = rayDir;
  for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    Hit h = intersectScene(rayOriginCurrent, rayDirCurrent);
    if (!h.hit) {
      radiance += throughput * skyColor(rayDirCurrent);
      break;
    }

    vec3 n = h.n;
    if (dot(n, rayDirCurrent) > 0.0) {
      n = -n;
    }

    Material mat = getMaterial(h.materialId);
    vec3     wo  = -rayDirCurrent;
    vec3     wi, weight, emission;
    bool     cont = scatter(mat, h.pos, n, wo, rng, wi, weight, emission);

    radiance += throughput * emission;
    radiance += throughput * directLighting(mat, h.pos, n, wo);

    if (!cont) {
      break;
    }
    throughput       *= weight;
    rayOriginCurrent  = h.pos + n * 1e-3;
    rayDirCurrent     = wi;
  }

  return radiance;
}