const int MAX_BOUNCES = 12;

uniform sampler2D uEnvMap;

vec3 skyColor(vec3 dir) {
  vec3        d         = normalize(dir);
  const float RECIP_PI  = 0.3183098861837907;
  const float RECIP_2PI = 0.15915494309189535;
  vec2        uv        = vec2(atan(d.z, d.x) * RECIP_2PI + 0.5,
                 asin(clamp(d.y, -1.0, 1.0)) * RECIP_PI + 0.5);
  return texture(uEnvMap, uv).rgb;
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
    bool     cont = scatter(mat,
                        h.position,
                        h.smoothNormal,
                        wo,
                        h.isFrontFace,
                        rng,
                        wi,
                        weight,
                        emission);

    radiance += throughput * emission;
    radiance += throughput *
                directLighting(mat, h.position, h.smoothNormal, h.geometricNormal, wo);

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