vec3 ambientLight(in float lightIntensity, in vec3 lightColor) {
  return lightColor * lightIntensity;
}

vec3 directionalLight(in float lightIntensity,
                      in vec3  lightColor,
                      in vec3  lightDir,
                      in vec3  normal) {
  return lightColor * lightIntensity * max(0.0, dot(normal, normalize(lightDir)));
}

vec3 pointLight(in float lightIntensity,
                in float lightFalloff,
                in vec3  lightColor,
                in vec3  lightPosition,
                in vec3  normal,
                in vec3  fragmentPosition) {
  vec3  delta   = lightPosition - fragmentPosition;
  vec3  dir     = normalize(delta);
  float falloff = max(0.0, 1.0 - length(delta) * lightFalloff);
  return lightColor * lightIntensity * falloff * max(0.0, dot(normal, dir));
}