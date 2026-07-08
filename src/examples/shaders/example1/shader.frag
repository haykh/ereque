uniform float uTime;
uniform vec2  uResolution;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec3 viewDirection = normalize(vPosition - cameraPosition);
  vec2 viewUv        = gl_FragCoord.xy / uResolution.y;
  vec3 normal        = normalize(vNormal);

  gl_FragColor = vec4(viewUv * vUv, (sin(uTime) + 0.5) * normal.x, 1.0);

#include <tonemapping_fragment>
  /**/
#include <colorspace_fragment>
}
