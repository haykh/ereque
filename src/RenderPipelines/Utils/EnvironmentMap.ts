import {
  LinearFilter,
  RepeatWrapping,
  ClampToEdgeWrapping,
  RedFormat,
  HalfFloatType,
  FloatType,
  DataUtils,
  DataTexture,
  NearestFilter,
} from "three";

import type CustomShaderMaterial from "../../Utils/CustomShaderMaterial";
import {
  GLSLShaderChunk,
  GLSLUniform,
  GLSLFunction,
} from "../../Utils/ShaderTemplate";
import { glsl } from "../../glsl";

export interface EnvironmentMapOptions {
  traceMaterial: CustomShaderMaterial;
  texture?: DataTexture | null;
}

export default class EnvironmentMap {
  private traceMaterial: CustomShaderMaterial;
  private cdfTexture: DataTexture | null = null;
  private pdfTexture: DataTexture | null = null;

  constructor(opts: EnvironmentMapOptions) {
    this.traceMaterial = opts.traceMaterial;
    this.traceMaterial.addUniform("uEnvMap", null, false);
    this.traceMaterial.addUniform("uEnvCDF", null, false);
    this.traceMaterial.addUniform("uEnvPdf", null, false);
    this.traceMaterial.addUniform("uEnvWidth", 1, false);
    this.traceMaterial.addUniform("uEnvHeight", 1, false);

    if (opts.texture) {
      this.setTexture(opts.texture);
    }
  }

  public setTexture(texture: DataTexture): void {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    this.traceMaterial.instance.uniforms.uEnvMap.value = texture;
    this.build(texture);
  }

  private build(texture: DataTexture): void {
    const img = texture.image as {
      data: ArrayBufferView;
      width: number;
      height: number;
    };
    const srcW = img.width,
      srcH = img.height;
    const raw = img.data as Uint16Array | Float32Array;
    const isHalf = texture.type === HalfFloatType;
    const chan = (i: number) =>
      isHalf ? DataUtils.fromHalfFloat(raw[i] as number) : (raw[i] as number);
    const lum = (px: number) =>
      0.2126 * chan(px * 4) +
      0.7152 * chan(px * 4 + 1) +
      0.0722 * chan(px * 4 + 2);

    // Downsample big envs to a manageable importance grid (radiance stays full-res).
    const target = 1024;
    const step = Math.max(1, Math.floor(srcW / target));
    const W = Math.max(1, Math.floor(srcW / step));
    const H = Math.max(1, Math.floor(srcH / step));

    // Box-averaged luminance on the importance grid.
    const L = new Float32Array(W * H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        let acc = 0,
          cnt = 0;
        for (let dy = 0; dy < step; dy++) {
          const sy = j * step + dy;
          if (sy >= srcH) {
            break;
          }
          for (let dx = 0; dx < step; dx++) {
            const sx = i * step + dx;
            if (sx >= srcW) {
              break;
            }
            acc += lum(sy * srcW + sx);
            cnt++;
          }
        }
        L[j * W + i] = cnt ? acc / cnt : 0;
      }

    let S = 0;
    for (let j = 0; j < H; j++) {
      const sinT = Math.sin((Math.PI * (j + 0.5)) / H);
      for (let i = 0; i < W; i++) {
        S += L[j * W + i] * sinT;
      }
    }
    S = Math.max(S, 1e-8);

    const pdfScale = (W * H) / (2 * Math.PI * Math.PI * S);
    const cdf = new Float32Array(W * H);
    const pdf = new Float32Array(W * H);
    let cum = 0;
    for (let j = 0; j < H; j++) {
      const sinT = Math.sin((Math.PI * (j + 0.5)) / H);
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        pdf[k] = L[k] * pdfScale;
        cum += (L[k] * sinT) / S;
        cdf[k] = cum;
      }
    }
    cdf[W * H - 1] = 1.0; // guard fp drift

    const mk = (data: Float32Array) => {
      const t = new DataTexture(data, W, H, RedFormat, FloatType);
      t.magFilter = t.minFilter = NearestFilter;
      t.needsUpdate = true;
      return t;
    };
    this.cdfTexture?.dispose();
    this.pdfTexture?.dispose();
    this.cdfTexture = mk(cdf);
    this.pdfTexture = mk(pdf);

    const u = this.traceMaterial.instance.uniforms;
    u.uEnvCDF.value = this.cdfTexture;
    u.uEnvPdf.value = this.pdfTexture;
    u.uEnvWidth.value = W;
    u.uEnvHeight.value = H;
  }

  public destroy(): void {
    this.cdfTexture?.dispose();
    this.pdfTexture?.dispose();
  }

  public static ShaderChunk(): GLSLShaderChunk {
    const uniforms = [
      new GLSLUniform("sampler2D", "uEnvMap"),
      new GLSLUniform("sampler2D", "uEnvCDF"),
      new GLSLUniform("sampler2D", "uEnvPdf"),
      new GLSLUniform("int", "uEnvWidth"),
      new GLSLUniform("int", "uEnvHeight"),
    ];

    const dirToUv = new GLSLFunction(
      "vec2",
      "envDirToUv",
      ["in vec3 dir"],
      [
        glsl`
        vec3 d = normalize(dir);
        return vec2(atan(d.z, d.x) * 0.15915494309189535 + 0.5,
                    asin(clamp(d.y, -1.0, 1.0)) * 0.3183098861837907 + 0.5);`,
      ],
    );

    const uvToDir = new GLSLFunction(
      "vec3",
      "envUvToDir",
      ["in vec2 uv"],
      [
        glsl`
        float phi = (uv.x - 0.5) * 6.283185307179586;
        float a   = (uv.y - 0.5) * 3.141592653589793;
        float ca  = cos(a);
        return vec3(ca * cos(phi), sin(a), ca * sin(phi));`,
      ],
    );

    const envColor = new GLSLFunction(
      "vec3",
      "envColor",
      ["in vec3 dir"],
      ["return texture(uEnvMap, envDirToUv(dir)).rgb;"],
    );

    const envPdf = new GLSLFunction(
      "float",
      "envPdf",
      ["in vec3 dir"],
      [
        glsl`
        vec2 uv = envDirToUv(dir);
        int  i  = clamp(int(uv.x * float(uEnvWidth)),  0, uEnvWidth  - 1);
        int  j  = clamp(int(uv.y * float(uEnvHeight)), 0, uEnvHeight - 1);
        return texelFetch(uEnvPdf, ivec2(i, j), 0).r;`,
      ],
    );

    // Binary-searches the flattened CDF, jitters within the chosen texel.
    const sampleEnv = new GLSLFunction(
      "void",
      "sampleEnv",
      ["inout uint rng", "out vec3 dir", "out float pdf", "out vec3 L"],
      [
        glsl`
        int W = uEnvWidth, H = uEnvHeight, N = W * H;
        float xi = rand(rng);
        int lo = 0, hi = N - 1;
        for (int it = 0; it < 32; it++) {
          if (lo >= hi) break;
          int mid = (lo + hi) >> 1;
          float c = texelFetch(uEnvCDF, ivec2(mid % W, mid / W), 0).r;
          if (c < xi) lo = mid + 1; else hi = mid;
        }
        int i = lo % W, j = lo / W;
        vec2 uv = vec2((float(i) + rand(rng)) / float(W),
                       (float(j) + rand(rng)) / float(H));
        dir = normalize(envUvToDir(uv));
        pdf = texelFetch(uEnvPdf, ivec2(i, j), 0).r;
        L   = envColor(dir);`,
      ],
    );

    const misWeight = new GLSLFunction(
      "float",
      "misWeight",
      ["in float a", "in float b"],
      [
        "return (a + b > 0.0) ? a / (a + b) : 0.0;", // balance heuristic
        // "float a2 = a*a, b2 = b*b; return (a2 + b2 > 0.0) ? a2 / (a2 + b2) : 0.0;" // power heuristic
      ],
    );

    return new GLSLShaderChunk(
      uniforms,
      [],
      [],
      [dirToUv, uvToDir, envColor, envPdf, sampleEnv, misWeight],
    );
  }
}
