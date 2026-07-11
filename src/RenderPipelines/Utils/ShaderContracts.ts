import type { GLSLFunctionSignature } from "../../Utils/ShaderTemplate";
import { GLSLContract } from "../../Utils/ShaderTemplate";

const GLSL_SCATTER_SIGNATURE: GLSLFunctionSignature = [
  "in Material mat",
  "in vec3 pos",
  "in vec3 n",
  "in vec3 wo",
  "in bool isFrontFace",
  "inout uint rng",
  "out vec3 wi",
  "out vec3 weight",
  "out vec3 emission",
  "out float pdf",
];

const GLSL_EVALBSDF_SIGNATURE: GLSLFunctionSignature = [
  "in Material mat",
  "in vec3 n",
  "in vec3 wo",
  "in vec3 wi",
];

const GLSL_OCCLUDED_SIGNATURE: GLSLFunctionSignature = [
  "in vec3 origin",
  "in vec3 dir",
  "in float maxDist",
];

const GLSL_DIRECT_LIGHTING_SIGNATURE: GLSLFunctionSignature = [
  "in Material mat",
  "in vec3 pos",
  "in vec3 n",
  "in vec3 ng",
  "in vec3 wo",
];

const GLSL_BSDFPDF_SIGNATURE: GLSLFunctionSignature = [
  "in Material mat",
  "in vec3 n",
  "in vec3 wo",
  "in vec3 wi",
];

export const GLSLScatterContract = new GLSLContract(
  "bool",
  GLSL_SCATTER_SIGNATURE,
);
export const GLSLEvalBSDFContract = new GLSLContract(
  "vec3",
  GLSL_EVALBSDF_SIGNATURE,
);
export const GLSLOccludedContract = new GLSLContract(
  "bool",
  GLSL_OCCLUDED_SIGNATURE,
);
export const GLSLDirectLightingContract = new GLSLContract(
  "vec3",
  GLSL_DIRECT_LIGHTING_SIGNATURE,
);
export const GLSLBSDFPdfContract = new GLSLContract(
  "float",
  GLSL_BSDFPDF_SIGNATURE,
);
