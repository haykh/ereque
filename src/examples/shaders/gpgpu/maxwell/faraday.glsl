uniform sampler2D uEM;
// x: Bx @ (i, j + 1/2)
// y: By @ (i + 1/2, j)
// z: Ezx @ (i, j)
// w: Ezy @ (i, j)
// Ez = z + w

uniform float uTimestep;

#include "./bc.glsl"

vec4 sampleEM(vec2 c) {
  return texture(uEM, bcCoord(c));
}

void main() {
  vec2  xy = gl_FragCoord.xy / resolution.xy, delta = vec2(1.0) / resolution.xy;
  float dt = uTimestep * 0.5 * sqrt(delta.x * delta.x + delta.y * delta.y);

  vec4 s = sampleEM(xy), su = sampleEM(xy + vec2(0.0, delta.y)),
       sr       = sampleEM(xy + vec2(delta.x, 0.0));
  float Ez_here = s.z + s.w, Ez_up = su.z + su.w, Ez_right = sr.z + sr.w;

  float sX = bcSigmaX(), sY = bcSigmaY();
  float caX = (1.0 - sX * dt * 0.5) / (1.0 + sX * dt * 0.5),
        cbX = dt / (1.0 + sX * dt * 0.5);
  float caY = (1.0 - sY * dt * 0.5) / (1.0 + sY * dt * 0.5),
        cbY = dt / (1.0 + sY * dt * 0.5);

  // dBx/dt + sigY Bx = -dEz/dy
  // dBy/dt + sigX By = dEz/dx
  float BxNew  = caY * s.x - cbY * (Ez_up - Ez_here) / delta.y;
  float ByNew  = caX * s.y + cbX * (Ez_right - Ez_here) / delta.x;
  gl_FragColor = vec4(BxNew, ByNew, s.z, s.w);
}

// vec4 solve(in vec2 xy, in float dt, in vec2 delta) {
//   float Bx_i_jp = texture(uEM, xy).x;
//   float By_ipj_ = texture(uEM, xy).y;
//   float Ez_i_j_ = texture(uEM, xy).z;
//   float Ez_i_jP = texture(uEM, xy + vec2(0.0, delta.y)).z;
//   float Ez_iPj_ = texture(uEM, xy + vec2(delta.x, 0.0)).z;
//   return vec4(Bx_i_jp - dt * (Ez_i_jP - Ez_i_j_) / delta.y,
//               By_ipj_ + dt * (Ez_iPj_ - Ez_i_j_) / delta.x,
//               Ez_i_j_,
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
