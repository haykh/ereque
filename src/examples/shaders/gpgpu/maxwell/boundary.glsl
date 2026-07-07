uniform sampler2D uEM;

#include "./bc.glsl"

void main() {
  vec2  xy = gl_FragCoord.xy / resolution.xy;
  ivec2 ij = ivec2(gl_FragCoord.xy), nc = ivec2(resolution.xy);
  vec4  s = texture(uEM, xy);

  bool xWall = (ij.x < 1 || ij.x >= nc.x - 1) &&
               uBoundaryConditions.x != BC_PERIODIC;
  bool yWall = (ij.y < 1 || ij.y >= nc.y - 1) &&
               uBoundaryConditions.y != BC_PERIODIC;
  float keep = (xWall || yWall) ? 0.0 : 1.0;

  gl_FragColor = s * keep;
}
