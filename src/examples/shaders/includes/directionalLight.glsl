vec3 directionalLight(in float lightIntensity,
                      in float specularPower,
                      in vec3  lightColor,
                      in vec3  lightPosition,
                      in vec3  normal,
                      in vec3  viewDirection) {
  vec3  lightDirection  = normalize(lightPosition);
  vec3  lightReflection = reflect(-lightDirection, normal);
  float shading         = max(0.0, dot(normal, lightDirection));
  float specular        = pow(max(0.0, -dot(lightReflection, viewDirection)),
                       specularPower);
  return lightColor * lightIntensity * (shading + specular);
}
