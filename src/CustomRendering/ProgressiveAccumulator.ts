import {
  WebGLRenderTarget,
  NearestFilter,
  Matrix4,
  HalfFloatType,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

import { glsl } from "../glsl";
import { RendererPipelineOptions } from "../Utils/RendererPipeline";
import CustomShaderMaterial from "../Utils/CustomShaderMaterial";

export interface ProgressiveAccumulatorOptions {
  renderer: RendererPipelineOptions["renderer"];
  sizes: RendererPipelineOptions["sizes"];
  camera: RendererPipelineOptions["camera"];
  debug: RendererPipelineOptions["debug"];
  sceneShader: string; // defines `vec3 sampleRadiance(Ray, inout float)` + scene uniforms
  fragmentShader?: string; // escape hatch: full trace fragment, bypasses sceneShader
  vertexShader?: string; // default: ACCUMULATOR_VERTEX_SHADER
  displayFragmentShader?: string; // default: DEFAULT_DISPLAY_FRAGMENT_SHADER
}

export default class ProgressiveAccumulator {
  private renderer: RendererPipelineOptions["renderer"];
  private sizes: ProgressiveAccumulatorOptions["sizes"];
  private camera: ProgressiveAccumulatorOptions["camera"];
  

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
    const traceFragment =
      opts.fragmentShader ?? buildTraceFragmentShader(opts.sceneShader);
    this.traceMaterial = new CustomShaderMaterial("trace material", {
      ...opts,
      vertexShader: opts.vertexShader ?? ACCUMULATOR_VERTEX_SHADER,
      fragmentShader: traceFragment,
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
      ...opts,
      vertexShader: opts.vertexShader ?? ACCUMULATOR_VERTEX_SHADER,
      fragmentShader:
        opts.displayFragmentShader ?? DEFAULT_DISPLAY_FRAGMENT_SHADER,
    });
    this.displayMaterial.addUniform("uAccum", null, false);

    // quads
    this.traceQuad = new FullScreenQuad(this.traceMaterial.instance);
    this.displayQuad = new FullScreenQuad(this.displayMaterial.instance);
  }

  protected markForRebuild(): void {
    this.frame = 1;
  }

  render(time?: { elapsedSec: number }): void {
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

  resize(): void {
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
    const res = this.sizes.pixelResolution;
    this.targets.forEach((t) =>
      t.setSize(Math.floor(res.x), Math.floor(res.y)),
    );
    this.markForRebuild();
  }

  destroy(): void {
    this.displayQuad.dispose();
    this.traceQuad.dispose();
    this.displayMaterial.destroy();
    this.traceMaterial.destroy();

    this.targets.forEach((t) => t.dispose());
  }
}

export const ACCUMULATOR_VERTEX_SHADER = glsl`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PREAMBLE = glsl`
uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uCameraPosition;
uniform mat4  uCameraWorldMatrix;
uniform mat4  uProjectionMatrixInverse;
uniform sampler2D uPrevAccum;
uniform float uFrame;
varying vec2 vUv;

struct Ray { vec3 origin; vec3 dir; };

// cheap float RNG (GLSL1). Swap for a uint PCG once you move to GLSL3.
float rand(inout float s) {
  s = fract(sin(s * 12.9898 + 78.233) * 43758.5453);
  return s;
}

Ray cameraRay(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  vec4 vp = uProjectionMatrixInverse * vec4(ndc, 1.0, 1.0); vp /= vp.w;
  Ray r;
  r.origin = uCameraPosition;
  r.dir = normalize((uCameraWorldMatrix * vec4(vp.xyz, 0.0)).xyz);
  return r;
}`;

const MAIN = glsl`
void main() {
  float seed = dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uFrame * 0.0618;
  vec2 jitter = vec2(rand(seed), rand(seed)) - 0.5;
  vec2 uv = (gl_FragCoord.xy + jitter) / uResolution;

  vec3 sampled = sampleRadiance(cameraRay(uv), seed);

  vec3 prev = texture2D(uPrevAccum, vUv).rgb;
  gl_FragColor = vec4(mix(prev, sampled, 1.0 / uFrame), 1.0);
}`;

export function buildTraceFragmentShader(sceneShader: string): string {
  return `${PREAMBLE}\n#line 1\n${sceneShader}\n${MAIN}`;
}

export const DEFAULT_DISPLAY_FRAGMENT_SHADER = glsl`
uniform sampler2D uAccum;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uAccum, vUv).rgb;
  c = c / (c + 1.0);            // Reinhard tone map (HDR -> LDR)
  c = pow(c, vec3(1.0 / 2.2));  // linear -> sRGB
  gl_FragColor = vec4(c, 1.0);
}`;
