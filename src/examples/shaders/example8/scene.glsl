#define MAX_STEPS  1024
#define INSIDE_BH  0
#define OUTSIDE_BH 1
#define DISK       2

struct BH {
  vec3  c;
  float rs;
};

struct Disk {
  vec3  normal;
  float rIn;
  float rOut;
  float spin;
  float temp;
  float brightness;
};

const BH bh = BH(vec3(0.0), 1.0);

const Disk disk = Disk(vec3(0.0, 1.0, 0.0), 3.0, 20.0, 1.0, 1e5, 1.0);

float d2u_dphi2(in float u) {
  return 1.5 * bh.rs * u * u - u;
}

void rk4step(inout float u, inout float du_dphi, in float dphi) {
  float k1 = d2u_dphi2(u);
  float k2 = d2u_dphi2(u + 0.5 * dphi * du_dphi);
  float k3 = d2u_dphi2(u + 0.5 * dphi * du_dphi + 0.25 * dphi * dphi * k1);
  float k4 = d2u_dphi2(u + dphi * du_dphi + 0.5 * dphi * dphi * k2);

  u       += dphi * du_dphi + (dphi * dphi / 6.0) * (k1 + k2 + k3);
  du_dphi += (dphi / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
}

int integrate(in vec3   o,
              in vec3   d,
              in float  maxDist,
              out vec3  of,
              out vec3  df,
              out float hitR,
              out float impactB,
              out vec3  axisOut) {
  d = normalize(d);

  vec3  r0vec = o - bh.c;
  float r0    = length(r0vec);
  vec3  rhat  = r0vec / r0; // radial unit vector at phi = 0

  float u          = 1.0 / r0;
  float invRs      = 1.0 / bh.rs;
  float invMaxDist = 1.0 / maxDist;

  // split the initial direction into radial + in-plane tangential parts
  float drds = dot(d, rhat);    // radial component of the unit dir
  vec3  tvec = d - drds * rhat; // tangential component
  float tlen = length(tvec);

  hitR    = 0.0;
  impactB = 0.0;
  axisOut = disk.normal;

  // near-radial ray
  if (tlen < 1e-4) {
    of = o;
    df = d;
    return (drds < 0.0) ? INSIDE_BH : OUTSIDE_BH;
  }

  vec3 phihat = tvec / tlen; // in-plane tangential unit (increasing phi)
  axisOut     = cross(rhat, phihat); // photon orbital-plane normal (unit)

  // analytic initial condition: du/dphi = -u * (d.rhat) / (d.phihat)
  float du_dphi = -u * drds / tlen;

  // conserved impact parameter b = L/E, from 1/b^2 = u'^2 + u^2 - rs u^3
  impactB = inversesqrt(max(du_dphi * du_dphi + u * u - bh.rs * u * u * u, 1e-12));

  float dphi = 0.01; // ~10 rad of sweep
  float phi  = 0.0;

  // signed height above the disk plane is (1/u)*(aN cos(phi) + bN sin(phi));
  // 1/u > 0, so a sign flip of (aN cos + bN sin) marks a plane crossing.
  float aN    = dot(rhat, disk.normal);
  float bN    = dot(phihat, disk.normal);
  float hPrev = aN; // phi = 0
  float uPrev = u;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (u >= invRs) {
      of = bh.c;
      df = d;
      return INSIDE_BH;
    }
    if (u <= invMaxDist) {
      break;
    }
    rk4step(u, du_dphi, dphi);
    phi += dphi;

    float hNew = aN * cos(phi) + bN * sin(phi);
    if (hPrev * hNew < 0.0) { // crossed the disk plane within this step
      float t = hPrev / (hPrev - hNew); // fractional step to the crossing
      float r = 1.0 / mix(uPrev, u, t); // radius at the crossing
      if (r >= disk.rIn && r <= disk.rOut) {
        hitR = r;
        of   = bh.c; // unused for a disk hit
        df   = d;
        return DISK; // opaque: nearest crossing wins
      }
    }
    hPrev = hNew;
    uPrev = u;
  }

  float dist   = 1.0 / u;
  float cosPhi = cos(phi);
  float sinPhi = sin(phi);

  // rotate the orbital frame by phi within the plane spanned by (rhat, phihat)
  vec3 rhatF = rhat * cosPhi + phihat * sinPhi;    // final radial unit vector
  vec3 phihatF = -rhat * sinPhi + phihat * cosPhi; // final tangential unit vector

  of = bh.c + dist * rhatF;

  // dr/dphi = -du_dphi / u^2  =>  tangent = (1/u) phihatF - (du_dphi/u^2)
  // rhatF, scaled by u^2 (positive) before normalizing:
  df = normalize(u * phihatF - du_dphi * rhatF);
  return OUTSIDE_BH;
}

// ---- gravitational blue/redshift (blackbody model) -----------------------
// A Doppler/gravitationally shifted blackbody is exactly another blackbody at
// temperature g*T, so the whole shift collapses to: estimate the texel's color
// temperature, scale it by g, recolor, and apply g^4 relativistic beaming.

// linear sRGB <-> CIE XYZ
vec3 linRgbToXyz(in vec3 c) {
  return vec3(dot(c, vec3(0.4124564, 0.3575761, 0.1804375)),
              dot(c, vec3(0.2126729, 0.7151522, 0.0721750)),
              dot(c, vec3(0.0193339, 0.1191920, 0.9503041)));
}

vec3 xyzToLinRgb(in vec3 c) {
  return vec3(dot(c, vec3(3.2404542, -1.5371385, -0.4985314)),
              dot(c, vec3(-0.9692660, 1.8760108, 0.0415560)),
              dot(c, vec3(0.0556434, -0.2040259, 1.0572252)));
}

// correlated color temperature from a linear-RGB color
float rgbToCct(in vec3 rgb) {
  vec3  X = linRgbToXyz(rgb);
  float s = X.x + X.y + X.z;
  if (s <= 0.0) {
    return 6500.0;
  }
  float x = X.x / s;
  float y = X.y / s;
  float n = (x - 0.3320) / (0.1858 - y);
  return 449.0 * n * n * n + 3525.0 * n * n + 6823.3 * n + 5520.33;
}

// Planckian locus chromaticity, T in Kelvin
vec2 planckXy(in float T) {
  float t  = clamp(T, 1667.0, 25000.0);
  float it = 1000.0 / t; // 1e3 / T
  float x;
  if (t < 4000.0) {
    x = -0.2661239 * it * it * it - 0.2343589 * it * it + 0.8776956 * it + 0.179910;
  } else {
    x = -3.0258469 * it * it * it + 2.1070379 * it * it + 0.2226347 * it + 0.240390;
  }
  float y;
  if (t < 2222.0) {
    y = -1.1063814 * x * x * x - 1.34811020 * x * x + 2.18555832 * x - 0.20219683;
  } else if (t < 4000.0) {
    y = -0.9549476 * x * x * x - 1.37418593 * x * x + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.0817580 * x * x * x - 5.87338670 * x * x + 3.75112997 * x - 0.37001483;
  }
  return vec2(x, y);
}

// unit-luminance (Y=1) linear-RGB color of a blackbody at temperature T
vec3 blackbodyLinRgb(in float T) {
  vec2 xy  = planckXy(T);
  vec3 XYZ = vec3(xy.x / xy.y, 1.0, (1.0 - xy.x - xy.y) / xy.y);
  return max(xyzToLinRgb(XYZ), vec3(0.0)); // clip out-of-gamut negatives
}

// g = nu_obs / nu_emit  (>1 blueshift). Recolor as a blackbody + beam by g^4.
vec3 gravShift(in vec3 L, in float g) {
  float T     = clamp(rgbToCct(L), 1000.0, 40000.0);
  float Tp    = clamp(g * T, 1000.0, 40000.0);
  vec3  ratio = blackbodyLinRgb(Tp) / max(blackbodyLinRgb(T), vec3(1e-3));
  ratio       = clamp(ratio, vec3(0.0), vec3(8.0)); // guard locus-edge blowups
  return L * ratio * (g * g * g * g); // g^4: relativistic beaming (bolometric)
}

vec3 sampleRadiance(in vec3 rayOrigin, in vec3 rayDir, inout uint rng) {
  vec3  of, df, axis;
  float rHit, b;
  int   hit = integrate(rayOrigin, rayDir, 200.0, of, df, rHit, b, axis);

  // static camera at radius rc carries its own factor sqrt(1 - rs/rc)
  float rc   = length(rayOrigin - bh.c);
  float gCam = sqrt(max(1.0 - bh.rs / rc, 1e-4));

  if (hit == OUTSIDE_BH) {
    // env map at infinity -> uniform blueshift g = 1 / gCam
    vec3 L = envColor(df) * uEnvIntensity;
    return gravShift(L, 1.0 / gCam);
  }

  if (hit == DISK) {
    // Keplerian circular orbit at rHit
    float Omega    = disk.spin * sqrt(bh.rs / (2.0 * rHit * rHit * rHit));
    float LzOverE  = b * dot(axis, disk.normal); // conserved
    float redshift = sqrt(max(1.0 - 1.5 * bh.rs / rHit, 1e-4));
    float g        = redshift / (gCam * (1.0 - Omega * LzOverE));
    g              = clamp(g, 0.05, 8.0); // tame grazing rays

    float Temit = disk.temp * pow(disk.rIn / rHit, 0.75); // thin-disk-ish profile
    float Tobs = clamp(g * Temit, 1000.0, 40000.0);       // shifted blackbody
    float Ie   = disk.brightness * pow(disk.rIn / rHit, 3.0) *
               max(1.0 - sqrt(disk.rIn / rHit), 0.0); // emission, fades at edge
    return blackbodyLinRgb(Tobs) * (Ie * g * g * g * g); // g^4 beaming
  }

  return vec3(0.0); // INSIDE_BH
}