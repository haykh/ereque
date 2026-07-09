vec3 pointLight(in float lightIntensity,
                in float specularPower,
                in float lightFalloff,
                in vec3  lightColor,
                in vec3  lightPosition,
                in vec3  normal,
                in vec3  viewDirection,
                in vec3  fragmentPosition) {
  vec3  lightDelta     = lightPosition - fragmentPosition;
  vec3  lightDirection = normalize(lightDelta);
  float falloff        = max(0.0, 1.0 - length(lightDelta) * lightFalloff);
  float shading        = max(0.0, dot(normal, lightDirection));
  float specular       = pow(
    max(0.0, -dot(reflect(-lightDirection, normal), viewDirection)),
    specularPower);
  return lightColor * lightIntensity * falloff * (shading + specular);
}
