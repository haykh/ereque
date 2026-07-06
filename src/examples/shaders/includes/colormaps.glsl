uniform float uColormapVmin;
uniform float uColormapVmax;
uniform int   uColormap;
uniform bool  uColormapReverse;

float base(in float t, in mat3 C) {
  return C[0][0] * sin(C[0][1] * t + C[0][2]) * exp(C[1][0] * t) +
         C[1][1] * cos(C[1][2] * t + C[2][0]) * exp(C[2][1] * t) + C[2][2];
}

const mat3 TURBO[3]   = mat3[3](mat3(-0.28165995,
                                   -16.3081226,
                                   13.9634704,
                                   -3.62257153,
                                   0.45090655,
                                   -6.3050797,
                                   4.58106802,
                                   0.02216693,
                                   0.54681307),
                              mat3(0.71070066,
                                   3.28851697,
                                   0.78650593,
                                   1.77966836,
                                   -0.01533207,
                                   0.77337289,
                                   3.73622403,
                                   7.12575883,
                                   -0.44066135),
                              mat3(2.28138126,
                                   4.17083282,
                                   0.10175855,
                                   -4.07297784,
                                   0.11213461,
                                   13.89434175,
                                   -3.46407341,
                                   -0.59775098,
                                   0.09609768));
const mat3 VIRIDIS[3] = mat3[3](mat3(2.65967487e-02,
                                     -6.07930692e+00,
                                     1.11844408e+00,
                                     3.32959188e+00,
                                     4.68713956e-03,
                                     2.05824308e+01,
                                     -1.53407662e+01,
                                     1.36362656e+00,
                                     2.57706615e-01),
                                mat3(3.91067464e+00,
                                     2.11895637e-01,
                                     -2.79995237e+00,
                                     -1.65937459e+00,
                                     4.16251858e-03,
                                     9.44093936e+00,
                                     -9.77201125e-01,
                                     1.83436778e+00,
                                     1.31195096e+00),
                                mat3(3.38779508e+01,
                                     5.57117956e-02,
                                     -3.13443887e+00,
                                     -1.33384084e+01,
                                     2.65520344e-04,
                                     3.33592474e+00,
                                     1.15609174e+00,
                                     8.90354900e+00,
                                     5.71764934e-01));
const mat3 INFERNO[3] = mat3[3](mat3(1.03612609e+02,
                                     4.01693459e-02,
                                     -3.12919086e+00,
                                     -3.61107336e+00,
                                     -3.08198298e-04,
                                     9.58062603e+00,
                                     -8.68079533e+00,
                                     6.65350667e+00,
                                     1.27869174e+00),
                                mat3(0.40236133,
                                     0.63338385,
                                     1.95174386,
                                     4.15657015,
                                     2.18338588,
                                     0.30383395,
                                     1.67944438,
                                     2.65444027,
                                     -0.12745758),
                                mat3(0.35840522,
                                     9.89166455,
                                     -1.10938888,
                                     -1.47427631,
                                     0.05921369,
                                     11.07196404,
                                     -5.56341554,
                                     1.98836138,
                                     0.28478504));
const mat3 FIRE[3]    = mat3[3](mat3(41.24435493,
                                  0.20011982,
                                  0.31158896,
                                  -0.38872882,
                                  -0.08536979,
                                  11.77623228,
                                  -9.70077967,
                                  -1.26105617,
                                  -12.70571258),
                             mat3(0.01548344,
                                  -15.41599548,
                                  11.64578123,
                                  1.90580766,
                                  0.04152733,
                                  -4.41170275,
                                  3.48648525,
                                  3.55026105,
                                  0.06308229),
                             mat3(7.65019042e-08,
                                  2.58346453e+00,
                                  -1.75420004e+00,
                                  1.58793326e+01,
                                  -7.08185311e-17,
                                  3.76463594e+01,
                                  -3.37666180e+01,
                                  3.69002306e+01,
                                  3.32037459e-05));
const mat3 BIPOLAR[3] = mat3[3](mat3(0.02386885,
                                     -14.98663646,
                                     11.62758757,
                                     1.78787942,
                                     0.04438218,
                                     -4.84715545,
                                     3.83848221,
                                     3.62247979,
                                     0.06994322),
                                mat3(1.16375206e-13,
                                     -1.11570189e-04,
                                     1.12119677e-04,
                                     3.79362846e+01,
                                     5.40159639e+01,
                                     3.86095239e-01,
                                     2.92977059e+00,
                                     -7.27464821e-03,
                                     5.38102855e+01),
                                mat3(0.14263463,
                                     -14.98660956,
                                     12.78376852,
                                     -1.78751184,
                                     1.66109224,
                                     4.84713759,
                                     -1.00861611,
                                     -3.62218137,
                                     0.06995593));
const mat3 SEISMIC[3] = mat3[3](mat3(0.15377221,
                                     17.80911846,
                                     -6.90237205,
                                     -2.12140418,
                                     -0.88224299,
                                     6.06362837,
                                     -0.91223798,
                                     -1.17036632,
                                     0.63917002),
                                mat3(1.36769386e-01,
                                     1.57564592e+01,
                                     -6.30743268e+00,
                                     2.22177769e-05,
                                     4.47540723e-01,
                                     7.90590717e+00,
                                     -3.95295421e+00,
                                     4.08485922e-06,
                                     3.13736926e-01),
                                mat3(0.40666685,
                                     6.11388346,
                                     -0.58782007,
                                     0.55325036,
                                     0.02736937,
                                     18.17689921,
                                     -3.42449595,
                                     1.46783493,
                                     0.56345957));

vec3 colormap(in float t, in mat3[3] C) {
  return clamp(vec3(base(t, C[0]), base(t, C[1]), base(t, C[2])), 0.0, 1.0);
}

vec3 turbo(in float t) {
  return colormap(t, TURBO);
}

vec3 turbo_r(in float t) {
  return turbo(1.0 - t);
}

vec3 viridis(in float t) {
  return colormap(t, VIRIDIS);
}

vec3 viridis_r(in float t) {
  return viridis(1.0 - t);
}

vec3 inferno(in float t) {
  return colormap(t, INFERNO);
}

vec3 inferno_r(in float t) {
  return inferno(1.0 - t);
}

vec3 fire(in float t) {
  return colormap(t, FIRE);
}

vec3 fire_r(in float t) {
  return fire(1.0 - t);
}

vec3 bipolar(in float t) {
  return colormap(t, BIPOLAR);
}

vec3 bipolar_r(in float t) {
  return bipolar(1.0 - t);
}

vec3 seismic(in float t) {
  return colormap(t, SEISMIC);
}

vec3 seismic_r(in float t) {
  return seismic(1.0 - t);
}

vec3 useColormap(in float t, in int colormapIndex, in bool reverse) {
  if (colormapIndex == 0) {
    return reverse ? turbo_r(t) : turbo(t);
  } else if (colormapIndex == 1) {
    return reverse ? viridis_r(t) : viridis(t);
  } else if (colormapIndex == 2) {
    return reverse ? inferno_r(t) : inferno(t);
  } else if (colormapIndex == 3) {
    return reverse ? fire_r(t) : fire(t);
  } else if (colormapIndex == 4) {
    return reverse ? bipolar_r(t) : bipolar(t);
  } else if (colormapIndex == 5) {
    return reverse ? seismic_r(t) : seismic(t);
  } else {
    return vec3(0.0);
  }
}

vec3 draw(in float t) {
  float v = (t - uColormapVmin) / (uColormapVmax - uColormapVmin);
  v       = clamp(v, 0.0, 1.0);
  return useColormap(v, uColormap, uColormapReverse);
}