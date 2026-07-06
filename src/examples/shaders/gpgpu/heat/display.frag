uniform float     uTime;
uniform vec2      uResolution;
uniform sampler2D uHeat;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

#include "../../includes/colormaps.glsl"

void main() {
  vec3 viewDirection = normalize(vPosition - cameraPosition);
  vec2 viewUv        = gl_FragCoord.xy / uResolution.y;
  vec3 normal        = normalize(vNormal);

  float fluidHeat = texture2D(uHeat, vUv).w;

  gl_FragColor = vec4(draw(fluidHeat), 1.0);

  // #include <tonemapping_fragment>
  //   /**/
  // #include <colorspace_fragment>
}
