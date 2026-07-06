uniform float uTimestep;

uniform sampler2D uVelocities;
uniform sampler2D uPositionsMasses;

void main() {
  vec2 xy = gl_FragCoord.xy / resolution.xy;

  vec3 vel = texture(uVelocities, xy).xyz;
  vec3 pos = texture(uPositionsMasses, xy).xyz;
  float mass = texture(uPositionsMasses, xy).w;

  pos += vel * uTimestep;

  gl_FragColor = vec4(pos, mass);
}
