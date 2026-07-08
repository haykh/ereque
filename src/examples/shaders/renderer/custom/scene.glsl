uniform BVH bvh;

const int   MAX_BOUNCES = 6;
const float PI          = 3.14159265;

struct Hit {
  bool  hit;
  float t;
  vec3  pos;
  vec3  n;
};

Hit intersectScene(in Ray ray) {
  Hit   h;
  uvec4 faceIndices;
  vec3  faceNormal, bary;
  float side, dist;
  h.hit = bvhIntersectFirstHit(bvh,
                               ray.origin,
                               ray.dir,
                               faceIndices,
                               faceNormal,
                               bary,
                               side,
                               dist);
  if (h.hit) {
    h.t   = dist;
    h.pos = ray.origin + dist * ray.dir;
    h.n   = faceNormal;
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
