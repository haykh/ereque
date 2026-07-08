// geometry
uniform sampler2D uTriangles;
uniform int       uNumTriangles;
uniform int       uTexWidth;

vec3 fetchVert(int i) {
  return texelFetch(uTriangles, ivec2(i % uTexWidth, i / uTexWidth), 0).xyz;
}

// Möller-Trumbore. Returns t>0 on hit (and geometric normal via out param), else -1.
float hitTriangle(vec3 ro, vec3 rd, vec3 v0, vec3 v1, vec3 v2, out vec3 n) {
  vec3  e1 = v1 - v0, e2 = v2 - v0;
  vec3  p   = cross(rd, e2);
  float det = dot(e1, p);
  if (abs(det) < 1e-8) {
    return -1.0;
  }
  float inv = 1.0 / det;
  vec3  tv  = ro - v0;
  float u   = dot(tv, p) * inv;
  if (u < 0.0 || u > 1.0) {
    return -1.0;
  }
  vec3  q = cross(tv, e1);
  float w = dot(rd, q) * inv;
  if (w < 0.0 || u + w > 1.0) {
    return -1.0;
  }
  float t = dot(e2, q) * inv;
  if (t <= 1e-4) {
    return -1.0;
  }
  n = normalize(cross(e1, e2));
  return t;
}

vec3 sampleRadiance(Ray ray, inout uint rng) {
  float closest = 1e30;
  vec3  hitN;
  bool  hit = false;
  for (int i = 0; i < uNumTriangles; i++) {
    int   b = i * 3;
    vec3  n;
    float t = hitTriangle(ray.origin,
                          ray.dir,
                          fetchVert(b),
                          fetchVert(b + 1),
                          fetchVert(b + 2),
                          n);
    if (t > 0.0 && t < closest) {
      closest = t;
      hitN    = n;
      hit     = true;
    }
  }
  if (hit) {
    if (dot(hitN, ray.dir) > 0.0) {
      hitN = -hitN;
    }
    return vec3(0.05) + max(dot(hitN, normalize(vec3(1.0))), 0.0) * vec3(0.85);
  }
  return mix(vec3(0.02), vec3(0.10, 0.15, 0.25), ray.dir.y * 0.5 + 0.5);
}
