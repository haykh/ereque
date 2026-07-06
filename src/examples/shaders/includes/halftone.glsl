vec3 halftone(float resolution,
              float shadeLow,
              float shadeHigh,
              vec3  shadeColor,
              vec3  baseColor,
              vec3  direction,
              vec2  uv,
              vec3  normal) {
  return mix(baseColor,
             shadeColor,
             1.0 - step(smoothstep(shadeLow, shadeHigh, dot(normal, direction)) * 0.5,
                        length(mod(uv * resolution, 1.0) - 0.5)));
}
