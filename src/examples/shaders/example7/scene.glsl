const int MAX_BOUNCES = 12;

vec3 sampleRadiance(in vec3 rayOrigin, in vec3 rayDir, inout uint rng) {
  vec3  radiance       = vec3(0.0);
  vec3  throughput     = vec3(1.0);
  vec3  o              = rayOrigin;
  vec3  d              = rayDir;
  bool  specularBounce = true;
  float lastPdf        = 0.0;

  for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    Hit h = intersectScene(o, d);

    if (!h.isHit) {
      if (specularBounce) {
        radiance += throughput * envColor(d);
      } else {
        float w   = misWeight(lastPdf, envPdf(d));
        radiance += throughput * envColor(d) * w;
      }
      break;
    }

    Material mat = getMaterial(h.materialId);
    vec3     wo  = -d;

    radiance += throughput *
                directLighting(mat, h.position, h.smoothNormal, h.geometricNormal, wo);

    // BSDF sample
    vec3  wi, weight, emission;
    float pdf;
    bool  cont  = scatter(mat,
                        h.position,
                        h.smoothNormal,
                        wo,
                        h.isFrontFace,
                        rng,
                        wi,
                        weight,
                        emission,
                        pdf);
    radiance   += throughput * emission;

    // environment NEE
    if (pdf >= 0.0) {
      vec3  wl, Le;
      float pdfL;
      sampleEnv(rng, wl, pdfL, Le);
      vec3 o2 = h.position + h.geometricNormal * 1e-3;
      if (pdfL > 0.0 && dot(wl, h.geometricNormal) > 0.0 &&
          !occluded(o2, wl, INFINITY)) {
        float pdfB  = pdfBSDF(mat, h.smoothNormal, wo, wl);
        float w     = misWeight(pdfL, pdfB);
        vec3  f     = evalBSDF(mat, h.smoothNormal, wo, wl);
        radiance   += throughput * f * max(dot(h.smoothNormal, wl), 0.0) * Le /
                    pdfL * w;
      }
    }

    if (!cont) {
      break;
    }

    throughput     *= weight;
    lastPdf         = pdf;
    specularBounce  = (pdf < 0.0);
    o = h.position + sign(dot(wi, h.geometricNormal)) * h.geometricNormal * 1e-3;
    d = wi;
  }
  return radiance;
}
