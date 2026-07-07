#define BC_PERIODIC 0.0
#define BC_REFLECT  1.0
#define BC_ABSORB   2.0

uniform vec2 uBoundaryConditions; // .x = left/right edges, .y = bottom/top edges
uniform float uPmlSigmaMax;
const float   PML_CELLS = 12.0;
const float   PML_ORDER = 3.0;

vec2 bcCoord(vec2 c) {
  if (uBoundaryConditions.x == BC_PERIODIC) {
    c.x = fract(c.x);
  }
  if (uBoundaryConditions.y == BC_PERIODIC) {
    c.y = fract(c.y);
  }
  return c;
}

float sigmaProfile(float idx, float n) {
  float d = max(PML_CELLS - idx, idx - (n - 1.0 - PML_CELLS));
  return uPmlSigmaMax * pow(clamp(d / PML_CELLS, 0.0, 1.0), PML_ORDER);
}

float bcSigmaX() {
  return uBoundaryConditions.x == BC_ABSORB
           ? sigmaProfile(gl_FragCoord.x, resolution.x)
           : 0.0;
}

float bcSigmaY() {
  return uBoundaryConditions.y == BC_ABSORB
           ? sigmaProfile(gl_FragCoord.y, resolution.y)
           : 0.0;
}
