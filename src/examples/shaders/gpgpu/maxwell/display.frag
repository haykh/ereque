uniform float     uTime;
uniform vec2      uResolution;
uniform int       uWhichField;
uniform sampler2D uEM;
// x: Bx @ (i, j + 1/2)
// y: By @ (i + 1/2, j)
// z: Ezx @ (i, j)
// w: Ezy @ (i, j)
// Ez = z + w

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

#include "../../includes/colormaps.glsl"

void main() {
  vec3 viewDirection = normalize(vPosition - cameraPosition);
  vec2 viewUv        = gl_FragCoord.xy / uResolution.y;
  vec3 normal        = normalize(vNormal);

  vec4  texture = texture2D(uEM, vUv);
  float field   = 0.0;
  if (uWhichField == 0) {
    field = texture.x; // Bx
  } else if (uWhichField == 1) {
    field = texture.y; // By
  } else if (uWhichField == 2) {
    field = texture.z + texture.w; // Ez
  }

  gl_FragColor = vec4(draw(field), 1.0);

  // #include <tonemapping_fragment>
  //   /**/
  // #include <colorspace_fragment>
}
