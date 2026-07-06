uniform sampler2D uVelocities;
uniform sampler2D uPositionsMasses;

uniform int   uNparticles;
uniform float uTimestep;

void main() {
  vec2  xy = gl_FragCoord.xy / resolution.xy;
  ivec2 ij = ivec2(gl_FragCoord.xy);

  vec3 vel = texture(uVelocities, xy).xyz;
  vec3 pos = texture(uPositionsMasses, xy).xyz;
  float mass = texture(uPositionsMasses, xy).w;
  
  vec3 accel = vec3(0.0);
  for (int n = 0; n < uNparticles; n++) {
    ivec2 ij_other = ivec2(n % int(resolution.x), n / int(resolution.x));
    if (ij_other == ij) {
      continue;
    }
    vec2 xy_other  = vec2(ij_other) / resolution.xy;
    vec3 pos_other = texture(uPositionsMasses, xy_other).xyz;
    float mass_other = texture(uPositionsMasses, xy_other).w;
    float distSqr = dot(pos_other - pos, pos_other - pos);
    distSqr = max(distSqr, 0.000001);
    float invDistCube = inversesqrt(distSqr * distSqr * distSqr);
    accel += (pos_other - pos) * mass_other * invDistCube;
  }
  vel += accel * uTimestep;
  gl_FragColor = vec4(vel, 1.0);
}
