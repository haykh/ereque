import type { Material, Vector3 } from "three";
import {
  Color,
  DataTexture,
  RGBAFormat,
  FloatType,
  NearestFilter,
} from "three";

import type CustomShaderMaterial from "../../Utils/CustomShaderMaterial";
import type { GLSLFunctionBody } from "../../Utils/ShaderTemplate";
import {
  GLSLStruct,
  GLSLMacro,
  GLSLFunction,
  GLSLUniform,
  GLSLShaderChunk,
} from "../../Utils/ShaderTemplate";
import { GLSLScatterContract, GLSLEvalBSDFContract } from "./ShaderContracts";

type GLSLType = "float" | "vec3";

interface MaterialProperty {
  name: string;
  type: GLSLType;
  extract: (m: Material) => number | Color | Vector3;
  fallback: number | [number, number, number];
}

export interface MaterialLibraryOptions {
  traceMaterial: CustomShaderMaterial;
  models?: Array<MaterialModel>;
}

export interface MaterialModel {
  name: string;
  scatter: GLSLFunctionBody;
  eval?: GLSLFunctionBody; // BRDF value for NEE; defaults to Lambertian eval
}

export default class MaterialLibrary {
  private traceMaterial: CustomShaderMaterial;
  private materialsTexture: DataTexture | null = null;
  private models: Array<MaterialModel>;
  private typeOf: Map<string, number>;

  private static readonly MATERIAL_SCHEMA: MaterialProperty[] = [
    {
      name: "albedo",
      type: "vec3",
      extract: (m: any) => m.color,
      fallback: [0.8, 0.8, 0.8],
    },
    {
      name: "emission",
      type: "vec3",
      extract: (m: any) =>
        (m.emissive ?? new Color())
          .clone()
          .multiplyScalar(m.emissiveIntensity ?? 1),
      fallback: [0, 0, 0],
    },
    {
      name: "roughness",
      type: "float",
      extract: (m: any) => m.roughness,
      fallback: 1.0,
    },
    {
      name: "metalness",
      type: "float",
      extract: (m: any) => m.metalness,
      fallback: 0.0,
    },
    {
      name: "ior",
      type: "float",
      extract: (m: any) => m.userData.ior ?? 1.0,
      fallback: 1.0,
    },
  ];

  constructor(opts: MaterialLibraryOptions) {
    this.traceMaterial = opts.traceMaterial;

    this.models = opts.models ?? [];
    this.typeOf = new Map([["default", 0]]);
    this.models.forEach((m, i) => this.typeOf.set(m.name, i + 1));

    this.traceMaterial.addUniform("uMaterials", null, false);
  }

  public build(materials: Material[]): void {
    const typeIds = materials.map(
      (m) => {
        const id = this.typeOf.get((m.userData?.model as string) ?? "default");
        if (id === undefined)
          console.warn(
            `MaterialLibrary: unknown model "${name}" → default. Pass it to both ShaderChunk() and the constructor.`,
          );
        return id ?? 0;
      },
    );
    const tex = MaterialLibrary.packMaterials(
      materials,
      MaterialLibrary.MATERIAL_SCHEMA,
      typeIds,
    );
    this.materialsTexture?.dispose();
    this.materialsTexture = tex;
    this.traceMaterial.instance.uniforms.uMaterials.value = tex;
  }

  public destroy(): void {
    this.materialsTexture?.dispose();
  }

  private static packMaterials(
    materials: Material[],
    schema: MaterialProperty[],
    typeIds: number[],
  ): DataTexture {
    const T = schema.length + 1,
      M = Math.max(1, materials.length);

    const data = new Float32Array(M * T * 4);
    materials.forEach((mat, k) => {
      schema.forEach((p, i) => {
        const b = (k * T + i) * 4;
        const v = p.extract(mat) ?? p.fallback;
        if (p.type === "float") {
          data[b] = v as number;
        } else {
          const c = v as any;
          data[b] = c.r ?? c.x;
          data[b + 1] = c.g ?? c.y;
          data[b + 2] = c.b ?? c.z;
        }
      });
      data[(k * T + schema.length) * 4] = typeIds[k] ?? 0; // type in reserved texel .r
    });
    const tex = new DataTexture(data, M * T, 1, RGBAFormat, FloatType);
    tex.magFilter = tex.minFilter = NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  public static ShaderChunk(models: MaterialModel[] = []): GLSLShaderChunk {
    const glslUniforms = [new GLSLUniform("sampler2D", "uMaterials")];

    const glslMacros = [new GLSLMacro("PI", "3.14159265")];

    const glslStructs = [
      new GLSLStruct("Material", [
        ...MaterialLibrary.MATERIAL_SCHEMA.map((p) => `${p.type} ${p.name}`),
        "int type",
      ]),
    ];

    const T = MaterialLibrary.MATERIAL_SCHEMA.length + 1; // +1 reserved for type
    const reads = MaterialLibrary.MATERIAL_SCHEMA.map((p, i) => {
      const t = `texelFetch1D(uMaterials, base + ${i}u)`;
      return p.type === "vec3"
        ? `m.${p.name} = ${t}.rgb;`
        : `m.${p.name} = ${t}.r;`;
    });
    const typeRead = `m.type = int(texelFetch1D(uMaterials, base + ${MaterialLibrary.MATERIAL_SCHEMA.length}u).r + 0.5);`;

    const DEFAULT_EVALBSDF = "return mat.albedo;";

    const scatterDefault = GLSLScatterContract.implement("scatter_default", [
      "emission = mat.emission;",
      "wi     = sampleHemisphere(n, rng);",
      "weight = mat.albedo;",
      "return true;",
    ]);
    const evalBSDFDefault = GLSLEvalBSDFContract.implement("evalBSDF_default", [
      DEFAULT_EVALBSDF,
    ]);

    const scatterModels = models.map((m) =>
      GLSLScatterContract.implement(`scatter_${m.name}`, m.scatter),
    );

    const scatter = GLSLScatterContract.implement("scatter", [
      ...scatterModels.map(
        (fn, i) => `if (mat.type == ${i + 1}) return ${fn.call()};`,
      ),
      `return ${scatterDefault.call()};`,
    ]);

    const evalBSDFModels = models.map((m) =>
      GLSLEvalBSDFContract.implement(
        `evalBSDF_${m.name}`,
        m.eval ?? DEFAULT_EVALBSDF,
      ),
    );

    const evalBSDF = GLSLEvalBSDFContract.implement("evalBSDF", [
      ...evalBSDFModels.map(
        (fn, i) => `if (mat.type == ${i + 1}) return ${fn.call()};`,
      ),
      `return ${evalBSDFDefault.call()};`,
    ]);

    const glslFunctions = [
      new GLSLFunction(
        "vec3",
        "sampleHemisphere",
        ["in vec3 n", "inout uint rng"],
        [
          "float u1 = rand(rng), u2 = rand(rng);",
          "float r = sqrt(u1), phi = 2.0 * PI * u2;",
          "vec3  up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);",
          "vec3  t  = normalize(cross(up, n));",
          "vec3  b  = cross(n, t);",
          "return normalize(r * cos(phi) * t + r * sin(phi) * b + sqrt(1.0 - u1) * n);",
        ],
      ),
      new GLSLFunction(
        "Material",
        "getMaterial",
        ["in int id"],
        [
          `uint base = uint(id) * ${T}u;`,
          "Material m;",
          ...reads,
          typeRead,
          "return m;",
        ],
      ),
      scatterDefault,
      ...scatterModels,
      scatter,
      evalBSDFDefault,
      ...evalBSDFModels,
      evalBSDF,
    ];

    return new GLSLShaderChunk(
      glslUniforms,
      glslMacros,
      glslStructs,
      glslFunctions,
    );
  }
}
