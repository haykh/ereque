uniform sampler2D uEM;
// x: Bx @ (i, j + 1/2)
// y: By @ (i + 1/2, j)
// z: Ezx @ (i, j)
// w: Ezy @ (i, j)
// Ez = z + w

uniform float uTimestep;

uniform vec2  uPointerUv;
uniform bool  uPointerClicked;
uniform float uSourceStrength;

float source(in vec2 xy, in vec2 delta) {
  vec2 dist = xy - uPointerUv;
  return uSourceStrength * float(abs(dist.x) < delta.x) *
         float(abs(dist.y) < delta.y) * float(uPointerClicked);
}

#include "./bc.glsl"

vec4 sampleEM(vec2 c) {
  return texture(uEM, bcCoord(c));
}

void main() {
  vec2  xy = gl_FragCoord.xy / resolution.xy, delta = vec2(1.0) / resolution.xy;
  float dt = uTimestep * 0.5 * sqrt(delta.x * delta.x + delta.y * delta.y);

  vec4  s       = sampleEM(xy);
  float Hy_left = sampleEM(xy - vec2(delta.x, 0.0)).y;
  float Hx_down = sampleEM(xy - vec2(0.0, delta.y)).x;

  float sX = bcSigmaX(), sY = bcSigmaY();
  float caX = (1.0 - sX * dt * 0.5) / (1.0 + sX * dt * 0.5),
        cbX = dt / (1.0 + sX * dt * 0.5);
  float caY = (1.0 - sY * dt * 0.5) / (1.0 + sY * dt * 0.5),
        cbY = dt / (1.0 + sY * dt * 0.5);

  // dEzx/dt + sigX Ezx = dBy/dx
  // dEzy/dt + sigY Ezy = -dBx/dy

  float EzxNew  = caX * s.z + cbX * (s.y - Hy_left) / delta.x;
  float EzyNew  = caY * s.w - cbY * (s.x - Hx_down) / delta.y;
  EzxNew       += dt * source(xy, delta);
  gl_FragColor  = vec4(s.x, s.y, EzxNew, EzyNew);
}

//
// vec4 solve(in vec2 xy, in float dt, in vec2 delta) {
//   float Ez_i_j_ = texture(uEM, xy).z;
//   float By_ipj_ = texture(uEM, xy).y;
//   float By_imj_ = texture(uEM, xy - vec2(delta.x, 0.0)).y;
//   float Bx_i_jp = texture(uEM, xy).x;
//   float Bx_i_jm = texture(uEM, xy - vec2(0.0, delta.y)).x;
//   return vec4(Bx_i_jp,
//               By_ipj_,
//               Ez_i_j_ + dt * ((By_ipj_ - By_imj_) / delta.x -
//                               (Bx_i_jp - Bx_i_jm) / delta.y + source(xy, delta)),
//               0.0);
// }
//
// void main() {
//   vec2 xy    = gl_FragCoord.xy / resolution.xy;
//   vec2 delta = vec2(1.0) / resolution.xy;
//
//   float dt = uTimestep * 0.5 * sqrt(delta.x * delta.x + delta.y * delta.y);
//
//   gl_FragColor = solve(xy, dt, delta);
// }
