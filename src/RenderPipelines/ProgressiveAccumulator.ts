import {
  GLSL3,
  WebGLRenderTarget,
  NearestFilter,
  Matrix4,
  HalfFloatType,
} from "three";
import type { WebGLRenderer, Camera } from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

import { glsl } from "../glsl";
import {
  RendererPipeline,
  RendererPipelineOptions,
} from "../Utils/RendererPipeline";
import CustomShaderMaterial from "../Utils/CustomShaderMaterial";
import {
  GLSLShaderChunk,
  GLSLFunction,
  GLSLUniform,
  GLSLVarying,
  GLSLStruct,
} from "../Utils/ShaderTemplate";

export interface ProgressiveAccumulatorOptions {
  renderer: WebGLRenderer;
  sizes: RendererPipelineOptions["sizes"];
  camera: Camera;
  resources: RendererPipelineOptions["resources"];
  sceneShader: string; // defines `vec3 sampleRadiance(Ray, inout float)` + scene uniforms
  fragmentShader?: string; // escape hatch: full trace fragment, bypasses sceneShader
  vertexShader?: string; // default: ProgressiveAccumulator.AccumulatorVertexShader()
  displayFragmentShader?: string; // default: ProgressiveAccumulator.DisplayFragmentShader()
}

export default class ProgressiveAccumulator implements RendererPipeline {
  protected renderer: WebGLRenderer;
  protected sizes: ProgressiveAccumulatorOptions["sizes"];
  protected camera: Camera;
  protected resources: RendererPipelineOptions["resources"];

  protected targets: [WebGLRenderTarget, WebGLRenderTarget];
  protected readIdx = 0;
  protected frame = 1;
  protected prevCamMatrix = new Matrix4();

  protected traceMaterial: CustomShaderMaterial;
  protected traceQuad: FullScreenQuad;
  protected displayMaterial: CustomShaderMaterial;
  protected displayQuad: FullScreenQuad;

  constructor(opts: ProgressiveAccumulatorOptions) {
    this.renderer = opts.renderer;
    this.sizes = opts.sizes;
    this.camera = opts.camera;
    this.resources = opts.resources;

    // ping-pong render targets
    const res = this.sizes.pixelResolution;
    const makeTarget = () =>
      new WebGLRenderTarget(Math.floor(res.x), Math.floor(res.y), {
        type: HalfFloatType,
        depthBuffer: false,
        magFilter: NearestFilter,
        minFilter: NearestFilter,
      });
    this.targets = [makeTarget(), makeTarget()];

    // trace material
    // const traceFragment =
    //   opts.fragmentShader ?? buildTraceFragmentShader(opts.sceneShader);
    this.traceMaterial = new CustomShaderMaterial("trace material", {
      sizes: this.sizes,
      vertexShader:
        opts.vertexShader ??
        ProgressiveAccumulator.AccumulatorVertexShader().render(),
      fragmentShader:
        opts.fragmentShader ??
        ProgressiveAccumulator.TraceFragmentShader(opts.sceneShader).render(),
      glslVersion: GLSL3,
    });

    this.traceMaterial.addUniform(
      "uCameraPosition",
      this.camera.position,
      false,
    );
    this.traceMaterial.addUniform(
      "uCameraWorldMatrix",
      this.camera.matrixWorld,
      false,
    );
    this.traceMaterial.addUniform(
      "uProjectionMatrixInverse",
      this.camera.projectionMatrixInverse,
      false,
    );
    this.traceMaterial.addUniform("uPrevAccum", null, false);
    this.traceMaterial.addUniform("uFrame", 1, false);

    // display material
    this.displayMaterial = new CustomShaderMaterial("display material", {
      sizes: this.sizes,
      vertexShader:
        opts.vertexShader ??
        ProgressiveAccumulator.AccumulatorVertexShader().render(),
      fragmentShader:
        opts.displayFragmentShader ??
        ProgressiveAccumulator.DisplayFragmentShader().render(),
      glslVersion: GLSL3,
    });
    this.displayMaterial.addUniform("uAccum", null, false);

    // quads
    this.traceQuad = new FullScreenQuad(this.traceMaterial.instance);
    this.displayQuad = new FullScreenQuad(this.displayMaterial.instance);
  }

  public initialize(): void {
    this.markForRedraw();
  }

  public markForRedraw(): void {
    this.frame = 1;
  }

  public render(time?: { elapsedSec: number }): void {
    this.camera.updateMatrixWorld();

    // reset accumulation on camera move
    if (!this.camera.matrixWorld.equals(this.prevCamMatrix)) {
      this.frame = 1;
      this.prevCamMatrix.copy(this.camera.matrixWorld);
    } else {
      this.frame += 1;
    }

    // read/write ping-pong targets
    const read = this.targets[this.readIdx];
    const write = this.targets[1 - this.readIdx];

    // trace: accumulate into `write`, reading last average from `read`
    const u = this.traceMaterial.instance.uniforms;
    u.uPrevAccum.value = read.texture;
    u.uFrame.value = this.frame;
    this.traceMaterial.update(time ?? { elapsedSec: 0 });
    this.renderer.setRenderTarget(write);
    this.traceQuad.render(this.renderer);

    // display: `write` -> screen
    this.displayMaterial.instance.uniforms.uAccum.value = write.texture;
    this.renderer.setRenderTarget(null);
    this.displayQuad.render(this.renderer);

    this.readIdx = 1 - this.readIdx;
  }

  public resize(): void {
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
    const res = this.sizes.pixelResolution;
    this.targets.forEach((t) =>
      t.setSize(Math.floor(res.x), Math.floor(res.y)),
    );
    this.markForRedraw();
  }

  public destroy(): void {
    this.displayQuad.dispose();
    this.traceQuad.dispose();
    this.displayMaterial.destroy();
    this.traceMaterial.destroy();

    this.targets.forEach((t) => t.dispose());
  }

  protected static AccumulatorVertexShader(): GLSLShaderChunk {
    return new GLSLShaderChunk({
      varyings: [new GLSLVarying("out", "vec2", "vUv")],
      functions: [
        new GLSLFunction(
          "void",
          "main",
          [],
          [
            glsl`
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);`,
          ],
        ),
      ],
    });
  }

  protected static DisplayFragmentShader(): GLSLShaderChunk {
    return new GLSLShaderChunk({
      uniforms: [new GLSLUniform("sampler2D", "uAccum")],
      varyings: [
        new GLSLVarying("in", "vec2", "vUv"),
        new GLSLVarying("out", "vec4", "fragColor"),
      ],
      functions: [
        new GLSLFunction(
          "void",
          "main",
          [],
          [
            glsl`
            vec3 c = texture(uAccum, vUv).rgb;
            c = c / (c + 1.0);            // Reinhard tone map (HDR -> LDR)
            c = pow(c, vec3(1.0 / 2.2));  // linear -> sRGB
            fragColor = vec4(c, 1.0);`,
          ],
        ),
      ],
    });
  }

  protected static TraceFragmentShader(sceneShader: string): GLSLShaderChunk {
    const uniforms = [
      new GLSLUniform("float", "uTime"),
      new GLSLUniform("vec2", "uResolution"),
      new GLSLUniform("vec3", "uCameraPosition"),
      new GLSLUniform("mat4", "uCameraWorldMatrix"),
      new GLSLUniform("mat4", "uProjectionMatrixInverse"),
      new GLSLUniform("sampler2D", "uPrevAccum"),
      new GLSLUniform("float", "uFrame"),
    ];

    const varyings = [
      new GLSLVarying("in", "vec2", "vUv"),
      new GLSLVarying("out", "vec4", "fragColor"),
    ];

    const structs = [new GLSLStruct("Ray", ["vec3 origin", "vec3 dir"])];

    const functions = [
      new GLSLFunction(
        "uint",
        "pcg",
        ["inout uint state"],
        [
          glsl`
          state = state * 747796405u + 2891336453u;
          uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
          return (word >> 22u) ^ word;`,
        ],
      ),
      new GLSLFunction(
        "float",
        "rand",
        ["inout uint state"],
        ["return float(pcg(state)) / 4294967295.0;"],
      ),
      new GLSLFunction(
        "Ray",
        "cameraRay",
        ["in vec2 uv"],
        [
          glsl`
          vec2 ndc = uv * 2.0 - 1.0;
          vec4 vp = uProjectionMatrixInverse * vec4(ndc, 1.0, 1.0);
          vp /= vp.w;
          Ray r;
          r.origin = uCameraPosition;
          r.dir = normalize((uCameraWorldMatrix * vec4(vp.xyz, 0.0)).xyz);
          return r;`,
        ],
      ),
    ];

    const mainShaderChunk = new GLSLShaderChunk({
      functions: [
        new GLSLFunction(
          "void",
          "main",
          [],
          [
            glsl`
            uvec2 p = uvec2(gl_FragCoord.xy);
            uint rng = (p.x * 1973u + p.y * 9277u + uint(uFrame) * 26699u) | 1u;

            vec2 jitter = vec2(rand(rng), rand(rng)) - 0.5;
            vec2 uv = (gl_FragCoord.xy + jitter) / uResolution;

            Ray ray = cameraRay(uv);
            vec3 sampled = sampleRadiance(ray.origin, ray.dir, rng);

            vec3 prev = texture(uPrevAccum, vUv).rgb;
            fragColor = vec4(mix(prev, sampled, 1.0 / uFrame), 1.0);
          `,
          ],
        ),
      ],
    });

    return new GLSLShaderChunk({
      uniforms,
      varyings,
      structs,
      functions,
      raw_postamble: sceneShader + "\n" + mainShaderChunk.render(),
    });
  }
}
