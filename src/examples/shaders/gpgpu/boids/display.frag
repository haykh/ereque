varying vec3 vVelocity;

#include "../../includes/colormaps.glsl"
#include "../../includes/utils.glsl"

void main() {
  float distanceToCenter = length(gl_PointCoord - 0.5);
  if (distanceToCenter > 0.5) {
    discard;
  }

  float velocity = remap(length(vVelocity) * 5.0, vec2(0.2, 0.4), vec2(0.0, 1.0));
  gl_FragColor = vec4(useColormap(velocity, 5, true), 1.0);

  // #include <tonemapping_fragment>
  /**/
  // #include <colorspace_fragment>
}
