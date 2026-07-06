vec3 directionalLight(float lightIntensity,
                      float specularPower,
                      vec3  lightColor,
                      vec3  lightPosition,
                      vec3  normal,
                      vec3  viewDirection) {
  vec3  lightDirection  = normalize(lightPosition);
  vec3  lightReflection = reflect(-lightDirection, normal);
  float shading         = max(0.0, dot(normal, lightDirection));
  float specular        = pow(max(0.0, -dot(lightReflection, viewDirection)),
                       specularPower);
  return lightColor * lightIntensity * (shading + specular);
}
