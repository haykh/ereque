float remap(in float value, in vec2 from, in vec2 to) {
  return to.x + (value - from.x) * (to.y - to.x) / (from.y - from.x);
}