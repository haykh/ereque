uniform float uTimestep;

uniform sampler2D uVelocities;
uniform sampler2D uPositions;

void main() {
  vec2 xy = gl_FragCoord.xy / resolution.xy;

  vec3 vel = texture(uVelocities, xy).xyz;
  vec3 pos = texture(uPositions, xy).xyz;

  pos += vel * uTimestep * 1e-1;

  gl_FragColor = vec4(pos, 1.0);
}
