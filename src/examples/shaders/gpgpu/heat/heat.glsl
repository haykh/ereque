#define M_PI 3.1415926535

uniform sampler2D uHeat;

uniform float uTime;
uniform float uTimestep;
uniform vec2  uPointerUv;
uniform bool  uPointerClicked;
uniform float uSourceStrength;

uniform float uConductivity;

float source(in vec2 xy, in vec2 delta) {
  vec2 dist = xy - uPointerUv;
  return uSourceStrength * float(abs(dist.x) < delta.x) *
         float(abs(dist.y) < delta.y) * float(uPointerClicked);
}

vec4 solve(in vec2 xy, in float dt, in vec2 delta) {
  float T          = texture(uHeat, xy).w;
  float TpX        = texture(uHeat, xy + vec2(delta.x, 0.0)).w;
  float TmX        = texture(uHeat, xy - vec2(delta.x, 0.0)).w;
  float TpY        = texture(uHeat, xy + vec2(0.0, delta.y)).w;
  float TmY        = texture(uHeat, xy - vec2(0.0, delta.y)).w;
  float laplacianT = (TpX - 2.0 * T + TmX) / (delta.x * delta.x) +
                     (TpY - 2.0 * T + TmY) / (delta.y * delta.y);
  return vec4(vec3(0.0), T + dt * laplacianT * uConductivity + source(xy, delta));
}

void main() {
  vec2 xy    = gl_FragCoord.xy / resolution.xy;
  vec2 delta = vec2(1.0) / resolution.xy;

  float dt = uTimestep * delta.x * delta.y / (uConductivity + 1e-10);

  gl_FragColor = solve(xy, dt, delta);
}
