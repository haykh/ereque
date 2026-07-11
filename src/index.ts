/**
 * Public API for the Three.js engine library.
 *
 * Consumers build an app by supplying their own `World` subclass to
 * `Experience`:
 *
 * ```ts
 * import { Experience, World } from "ereque";
 *
 * class MyWorld extends World {
 *   initialize() {  }
 *   update() { super.update();  }
 * }
 *
 * new Experience(document.querySelector("canvas.webgl"), { World: MyWorld });
 * ```
 */

// Core orchestration
export { default as Experience } from "./Experience";
export type { ExperienceConfig, WorldConstructor } from "./Experience";

// World extension point
export { World } from "./World";
export type { WorldOptions } from "./World";

// Scene infrastructure
export { default as Camera } from "./Camera";
export { default as Renderer } from "./Renderer";

// Custom renderer pipeline
export { default as DefaultRendererPipeline } from "./Utils/RendererPipeline";
export type {
  RendererPipeline,
  RendererPipelineOptions,
  RendererPipelineFactory,
} from "./Utils/RendererPipeline";
export {
  default as ProgressiveAccumulator,
  buildTraceFragmentShader,
  ACCUMULATOR_VERTEX_SHADER,
  DEFAULT_DISPLAY_FRAGMENT_SHADER,
} from "./RenderPipelines/ProgressiveAccumulator";
export type { ProgressiveAccumulatorOptions } from "./RenderPipelines/ProgressiveAccumulator";

// Asset loading
export { default as Resources } from "./Utils/Resources";
export type { Source, SourceList, SourceType } from "./sources";

// GPGPU compute engine
export { default as GPUComputationRenderer } from "./GPGPU/GPGPU";
export type { VariableType, ShaderType } from "./GPGPU/GPGPU";
export {
  default as GPGPURenderer,
  GPGPUGridRenderer2D,
  GPGPUParticleRenderer,
} from "./GPGPU/GPGPURenderer";
export type { GPGPURendererOptions } from "./GPGPU/GPGPURenderer";
export { GridSimulation, ParticleSimulation } from "./GPGPU/Simulation";
export type { SimulationOptions } from "./GPGPU/Simulation";

// Utilities
export { default as CustomShaderMaterial } from "./Utils/CustomShaderMaterial";
export { default as EventEmitter } from "./Utils/EventEmitter";
export { default as Sizes } from "./Utils/Sizes";
export { default as Time } from "./Utils/Time";
export { default as MouseTracker } from "./Utils/MouseTracker";
export { default as DisposeScene } from "./Utils/Dispose";
export { default as Debug, DebugCanvas, DebugQuad } from "./Utils/Debug";
export {
  SceneMeshSignature,
  SceneLightSignature,
} from "./Utils/SceneSignatures";
export {
  EnableCastReceiveShadows,
  ShaderHookAfter,
  Capitalize,
} from "./Utils/Snippets";
export type {
  GLSLFunctionArgAccessor,
  GLSLFunctionSignature,
  GLSLFunctionBody,
} from "./Utils/ShaderTemplate";
export {
  StringTemplate,
  GLSLMacro,
  GLSLVariable,
  GLSLFunctionArg,
  GLSLFunction,
  GLSLCallable,
  GLSLStruct,
  GLSLContract,
  GLSLShaderChunk,
} from "./Utils/ShaderTemplate";

// Utils for custom rendering pipelines
export { default as BVHScene } from "./RenderPipelines/Utils/BVHScene";
export type { BVHSceneOptions } from "./RenderPipelines/Utils/BVHScene";
export { default as CustomShaderLights } from "./RenderPipelines/Utils/CustomShaderLights";
export type { CustomShaderLightsOptions } from "./RenderPipelines/Utils/CustomShaderLights";
export type {
  MaterialLibraryOptions,
  MaterialModel,
} from "./RenderPipelines/Utils/MaterialLibrary";
export { default as MaterialLibrary } from "./RenderPipelines/Utils/MaterialLibrary";
export {
  GLSLScatterContract,
  GLSLEvalBSDFContract,
} from "./RenderPipelines/Utils/ShaderContracts";
export { default as EnvironmentMap } from "./RenderPipelines/Utils/EnvironmentMap";
export type { EnvironmentMapOptions } from "./RenderPipelines/Utils/EnvironmentMap";

// GLSL tagged-template helper (for inline shader source with editor highlighting)
export { glsl } from "./glsl";
