uniform float uTime;
varying vec2  vUv;

void main() {
  // UV gradient, blue channel pulses so you can see the loop is live
  gl_FragColor = vec4(vUv, 0.5 + 0.5 * sin(uTime), 1.0);
}
