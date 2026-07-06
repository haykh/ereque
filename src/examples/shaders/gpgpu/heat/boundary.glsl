#define M_PI 3.1415926535

uniform sampler2D uHeat;

void main() {
  vec2  xy     = gl_FragCoord.xy / resolution.xy;
  vec2  delta  = vec2(1.0) / resolution.xy;
  ivec2 ij     = ivec2(gl_FragCoord.xy);
  ivec2 ncells = ivec2(resolution.xy);

  float isLeftGhost   = float(ij.x < 1);
  float isRightGhost  = float(ij.x >= ncells.x - 1);
  float isNotLRGhost  = (1.0 - isLeftGhost) * (1.0 - isRightGhost);
  float isBottomGhost = float(ij.y < 1) * isNotLRGhost;
  float isTopGhost    = float(ij.y >= ncells.y - 1) * isNotLRGhost;

  float isActive = isNotLRGhost * (1.0 - isBottomGhost) * (1.0 - isTopGhost);

  float T = isLeftGhost * sin(xy.y * M_PI) +
            isRightGhost * (1.0 - sin(xy.y * M_PI)) +
            isBottomGhost * texture(uHeat, xy + vec2(0.0, resolution.y - 4.0)).w +
            isTopGhost * texture(uHeat, xy - vec2(0.0, resolution.y - 4.0)).w +
            isActive * texture(uHeat, xy).w;

  gl_FragColor = vec4(vec3(0.0), T);
}
