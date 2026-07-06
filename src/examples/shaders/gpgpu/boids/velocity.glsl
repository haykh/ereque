uniform sampler2D uVelocities;
uniform sampler2D uPositions;

uniform int   uNparticles;
uniform float uTimestep;
uniform float uSeparationRange;
uniform float uSeparationFactor;
uniform float uVisibleRange;
uniform float uAlignmentFactor;
uniform float uCohesionFactor;
uniform float uTurnFactor;
uniform vec2  uSpeedMinMax;

void main() {
  vec2  xy = gl_FragCoord.xy / resolution.xy;
  ivec2 ij = ivec2(gl_FragCoord.xy);

  vec3 vel = texture(uVelocities, xy).xyz;
  vec3 pos = texture(uPositions, xy).xyz;

  vec3 separationDelta = vec3(0.0);
  vec3 alignmentAvg    = vec3(0.0);
  vec3 cohesionAvg     = vec3(0.0);
  int  visibleCount    = 0;
  for (int n = 0; n < uNparticles; n++) {
    ivec2 ij_other = ivec2(n % int(resolution.x), n / int(resolution.x));
    if (ij_other == ij) {
      continue;
    }
    vec2 xy_other  = vec2(ij_other) / resolution.xy;
    vec3 pos_other = texture(uPositions, xy_other).xyz;
    if (distance(pos_other, pos) < uSeparationRange) {
      separationDelta += (pos - pos_other);
    }
    if (distance(pos_other, pos) < uVisibleRange) {
      vec3 vel_other  = texture(uVelocities, xy_other).xyz;
      vec3 pos_other  = texture(uPositions, xy_other).xyz;
      alignmentAvg   += vel_other;
      cohesionAvg    += pos_other;
      visibleCount   += 1;
    }
  }
  if (visibleCount > 0) {
    alignmentAvg /= float(visibleCount);
    cohesionAvg  /= float(visibleCount);

    vel += (separationDelta * uSeparationFactor +
            (alignmentAvg - vel) * uAlignmentFactor +
            (cohesionAvg - pos) * uCohesionFactor) *
           uTimestep;
  }

  vel.x += (float(pos.x < -5.0) * uTurnFactor - float(pos.x > 5.0) * uTurnFactor) *
           uTimestep;
  vel.y += (float(pos.y < -5.0) * uTurnFactor - float(pos.y > 5.0) * uTurnFactor) *
           uTimestep;
  vel.z += (float(pos.z < -5.0) * uTurnFactor - float(pos.z > 5.0) * uTurnFactor) *
           uTimestep;

  vel = normalize(vel) * clamp(length(vel), uSpeedMinMax.x, uSpeedMinMax.y);

  gl_FragColor = vec4(vel, 1.0);
}
