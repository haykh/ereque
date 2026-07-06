uniform float uTime;
uniform vec2  uResolution;
uniform float uSize;

uniform sampler2D uPositionsMasses;
uniform sampler2D uVelocities;
uniform vec2      uTextureSize;

attribute vec2 aUV;

void main() {
  vec4 position_mass = texture(uPositionsMasses, aUV);

  // Final position
  vec4 modelPosition     = modelMatrix * vec4(position_mass.xyz, 1.0);
  vec4 viewPosition      = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_Position            = projectedPosition;

  float size = 10.0 * uSize * position_mass.w;

  gl_PointSize = (size / -viewPosition.z);
}
