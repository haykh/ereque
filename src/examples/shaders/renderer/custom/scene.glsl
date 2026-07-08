// geometry
uniform sampler2D uTriangles;
uniform int       uNumTriangles;
uniform int       uTexWidth;

const int   MAX_BOUNCES = 6;
const float PI          = 3.14159265;

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

struct Hit {
  bool  hit;
  float t;
  vec3  pos;
  vec3  n;
};

Hit intersectScene(in Ray ray) {
  Hit h;
  h.hit = false;
  h.t   = 1e30;
  for (int i = 0; i < uNumTriangles; i++) {
    int  b = i * 3;
    vec3 n;
    float t = hitTriangle(ray.origin, ray.dir, fetchVert(b), fetchVert(b + 1), fetchVert(b + 2), n);
    if (t > 0.0 && t < h.t) {
      h.t   = t;
      h.n   = n;
      h.hit = true;
    }
  }
  if (h.hit) {
    h.pos = ray.origin + h.t * ray.dir;
  }
  return h;
}

vec3 skyColor(vec3 dir) {
  return mix(vec3(0.8, 0.8, 0.9), vec3(0.2, 0.3, 0.7), dir.y * 0.5 + 0.5) * 1.6;
}

vec3 sampleHemisphere(vec3 n, inout uint rng) {
  float u1 = rand(rng), u2 = rand(rng);
  float r = sqrt(u1), phi = 2.0 * PI * u2;
  vec3  up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3  t  = normalize(cross(up, n));
  vec3  b  = cross(n, t);
  return normalize(r * cos(phi) * t + r * sin(phi) * b + sqrt(1.0 - u1) * n);
}

vec3 sampleRadiance(in Ray ray, inout uint rng) {
  vec3 radiance   = vec3(0.0);
  vec3 throughput = vec3(1.0);
  vec3 albedo     = vec3(0.75);
  Ray  currentRay = ray;
  for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    Hit h = intersectScene(currentRay);
    if (!h.hit) {
      radiance += throughput * skyColor(currentRay.dir);
      break;
    }
    vec3 n = h.n;
    if (dot(n, currentRay.dir) > 0.0) {
      n = -n; // face the incoming ray
    }

    currentRay.origin = h.pos + n * 1e-3; // offset off the surface (no self-hit)
    currentRay.dir  = sampleHemisphere(n, rng); // diffuse scatter
    throughput     *= albedo; // Lambert: pdf cancels the cosine
  }
  return radiance;
}
