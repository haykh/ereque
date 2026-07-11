import { Matrix4 } from "three";

import { glsl } from "../glsl";
import { RendererPipeline } from "../Utils/RendererPipeline";
import {
  GLSLShaderChunk,
  GLSLFunction,
  GLSLUniform,
  GLSLVarying,
  GLSLStruct,
} from "../Utils/ShaderTemplate";
import PingPongRenderer from "./PingPongRenderer";
import type { PingPongRendererOptions } from "./PingPongRenderer";

export type ProgressiveAccumulatorOptions = PingPongRendererOptions;

export default class ProgressiveAccumulator
  extends PingPongRenderer
  implements RendererPipeline
{
  protected readIdx = 0;
  protected frame = 1;
  protected prevCamMatrix = new Matrix4();

  constructor(opts: ProgressiveAccumulatorOptions) {
    super({
      ...opts,
      vertexShader:
        opts.vertexShader ?? ProgressiveAccumulator.VertexShader().render(),
      fragmentShader:
        opts.fragmentShader ??
        ProgressiveAccumulator.TraceFragmentShader(opts.sceneShader).render(),
      displayFragmentShader:
        opts.displayFragmentShader ??
        ProgressiveAccumulator.DisplayFragmentShader().render(),
    });
    this.traceMaterial.addUniform("uPrevRendered", null, false);
    this.traceMaterial.addUniform("uFrame", 1, false);
  }

  public initialize(): void {
    this.markForRedraw();
  }

  public markForRedraw(): void {
    this.frame = 1;
  }

  public override render(time?: { elapsedSec: number }): void {
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
    u.uPrevRendered.value = read.texture;
    u.uFrame.value = this.frame;
    this.traceMaterial.update(time ?? { elapsedSec: 0 });
    this.renderer.setRenderTarget(write);
    this.traceQuad.render(this.renderer);

    // display: `write` -> screen
    this.displayMaterial.instance.uniforms.uRendered.value = write.texture;
    this.renderer.setRenderTarget(null);
    this.displayQuad.render(this.renderer);

    this.readIdx = 1 - this.readIdx;
  }

  public override resize(): void {
    super.resize();
    this.markForRedraw();
  }

  protected static VertexShader(): GLSLShaderChunk {
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
      uniforms: [new GLSLUniform("sampler2D", "uRendered")],
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
            vec3 c = texture(uRendered, vUv).rgb;
            c = c / (c + 1.0);            // Reinhard tone map (HDR -> LDR)
            c = pow(c, vec3(1.0 / 2.2));  // linear -> sRGB
            fragColor = vec4(c, 1.0);`,
          ],
        ),
      ],
    });
  }

  protected static TraceFragmentShader(sceneShader?: string): GLSLShaderChunk {
    const uniforms = [
      new GLSLUniform("float", "uTime"),
      new GLSLUniform("vec2", "uResolution"),
      new GLSLUniform("vec3", "uCameraPosition"),
      new GLSLUniform("mat4", "uCameraWorldMatrix"),
      new GLSLUniform("mat4", "uProjectionMatrixInverse"),
      new GLSLUniform("sampler2D", "uPrevRendered"),
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

            vec3 prev = texture(uPrevRendered, vUv).rgb;
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
      raw_postamble: [sceneShader ?? "", mainShaderChunk.render()].join("\n"),
    });
  }
}
