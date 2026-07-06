uniform float uTime;
uniform vec2  uResolution;
uniform float uSize;

uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform vec2      uTextureSize;

attribute vec2 aUV;

varying vec3 vVelocity;

void main() {
  vec4 particle = texture(uPositions, aUV);

  // Final position
  vec4 modelPosition     = modelMatrix * vec4(particle.xyz, 1.0);
  vec4 viewPosition      = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_Position            = projectedPosition;

  float size = 10.0 * uSize;

  gl_PointSize = (size / -viewPosition.z);

  // Varyings
  vVelocity = texture(uVelocities, aUV).xyz;
}
