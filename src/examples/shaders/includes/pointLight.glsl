vec3 pointLight(float lightIntensity,
                float specularPower,
                float lightFalloff,
                vec3  lightColor,
                vec3  lightPosition,
                vec3  normal,
                vec3  viewDirection,
                vec3  fragmentPosition) {
  vec3  lightDelta     = lightPosition - fragmentPosition;
  vec3  lightDirection = normalize(lightDelta);
  float falloff        = max(0.0, 1.0 - length(lightDelta) * lightFalloff);
  float shading        = max(0.0, dot(normal, lightDirection));
  float specular       = pow(
    max(0.0, -dot(reflect(-lightDirection, normal), viewDirection)),
    specularPower);
  return lightColor * lightIntensity * falloff * (shading + specular);
}
