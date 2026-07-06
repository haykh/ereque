import {
  type WebGLRenderer,
  type Texture,
  type Material,
  type MagnificationTextureFilter,
  type Wrapping,
  type HalfFloatType,
  Uniform,
  DataTexture,
  FloatType,
  NearestFilter,
  ShaderMaterial,
  WebGLRenderTarget,
  ClampToEdgeWrapping,
  RGBAFormat,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

type FloatTextureType = typeof FloatType | typeof HalfFloatType;

export type VariableType = {
  name: string;
  renderTargets: Array<WebGLRenderTarget>;
  wrap: {
    S: Wrapping | null;
    T: Wrapping | null;
  };
  minMagFilter: {
    min: MagnificationTextureFilter;
    mag: MagnificationTextureFilter;
  };
  currentTextureIndex: number;
};
export type ShaderType = {
  material: ShaderMaterial;
  inputVariables: Array<VariableType>;
  outputVariable: VariableType;
};

export default class GPUComputationRenderer {
  protected readonly renderer: WebGLRenderer;
  public readonly textureSize: { x: number; y: number };

  protected dataType: FloatTextureType = FloatType;

  protected readonly quad: FullScreenQuad;
  protected readonly passThruUniforms: { [Key: string]: Uniform<any> } = {
    passThruTexture: new Uniform(null),
  };
  protected readonly passThruShader: ShaderMaterial;

  public variables: { [Key: string]: VariableType } = {};
  public shaders: { [Key: string]: ShaderType } = {};

  /**
   * Constructs a new GPU computation renderer.
   *
   * @param textureSize - Computation problem size in 2D.
   * @param renderer - The renderer.
   */
  constructor(textureSize: { x: number; y: number }, renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.textureSize = textureSize;

    this.passThruShader = this.createShaderMaterial(
      this.getPassThroughFragmentShader(),
      this.passThruUniforms,
    );

    this.quad = new FullScreenQuad(this.passThruShader);
  }

  /**
   * Sets the data type of the internal textures.
   *
   * @param type - The type to set.
   * @return A reference to this renderer.
   */
  setDataType(type: FloatTextureType): GPUComputationRenderer {
    this.dataType = type;
    return this;
  }

  /**
   * Adds a compute variable to the renderer.
   *
   * @param name - The variable name.
   * @return The compute variable.
   */
  addVariable(name: string): VariableType {
    const variable: VariableType = {
      name: name,
      renderTargets: [],
      wrap: { S: null, T: null },
      minMagFilter: { min: NearestFilter, mag: NearestFilter },
      currentTextureIndex: 0,
    };

    this.variables[name] = variable;

    return variable;
  }

  /**
   * Adds a compute shader to the renderer.
   *
   * @param name - The shader name.
   * @param computeFragmentShader - The compute fragment shader.
   * @param outputVariable - The output variable name.
   * @param inputVariables - The input variable names.
   * @param uniforms - The uniforms.
   * @return The compute shader.
   */
  addComputeShader(
    name: string,
    computeFragmentShader: string,
    outputVariable: string,
    inputVariables: Array<string> | null = null,
    uniforms: { [Key: string]: Uniform<any> } = {},
  ): ShaderType {
    const material = this.createShaderMaterial(computeFragmentShader, uniforms);
    const inputVars =
      inputVariables?.map((name) => {
        const variable = this.variables[name];
        if (!variable) {
          throw new Error(`Variable not found: ${name}`);
        }
        return variable;
      }) || [];

    const outputVar = this.variables[outputVariable];
    if (!outputVar) {
      throw new Error(`Variable not found: ${outputVariable}`);
    }

    const shader: ShaderType = {
      material: material,
      inputVariables: inputVars,
      outputVariable: outputVar,
    };

    this.shaders[name] = shader;
    return shader;
  }

  /**
   * Initializes the renderer.
   */
  init(initValues: { [Key: string]: Texture } = {}) {
    if (this.renderer.capabilities.maxVertexTextures === 0) {
      throw new Error("No support for vertex shader textures.");
    }

    Object.values(this.variables).forEach((variable) => {
      const init_texture = initValues[variable.name] || this.createTexture();
      // Creates rendertargets and initialize them with input texture
      variable.renderTargets[0] = this.createRenderTarget(
        this.textureSize,
        variable.wrap,
        variable.minMagFilter,
      );
      variable.renderTargets[1] = this.createRenderTarget(
        this.textureSize,
        variable.wrap,
        variable.minMagFilter,
      );
      this.renderTexture(init_texture, variable.renderTargets[0]);
      this.renderTexture(init_texture, variable.renderTargets[1]);
    });

    Object.entries(this.shaders).forEach(([shader_name, shader]) => {
      shader.inputVariables.forEach((variable) => {
        console.log(
          `COMPUTE SHADER ${shader_name}: uniform u${variable.name} added`,
        );
        shader.material.uniforms[`u${variable.name}`] = new Uniform(null);
      });
    });
  }

  compute(shader: string) {
    const outputVariable = this.shaders[shader].outputVariable;
    const nextTextureIndex = outputVariable.currentTextureIndex === 0 ? 1 : 0;
    // Sets texture dependencies uniforms
    const inputVariables = this.shaders[shader].inputVariables;
    for (let i = 0; i < inputVariables.length; i++) {
      const variable = inputVariables[i];
      this.shaders[shader].material.uniforms[`u${variable.name}`].value =
        variable.renderTargets[variable.currentTextureIndex].texture;
    }
    // Performs the computation for this variable
    this.doRenderTarget(
      this.shaders[shader].material,
      outputVariable.renderTargets[nextTextureIndex],
    );
    outputVariable.currentTextureIndex = nextTextureIndex;
  }

  /**
   * Returns the current render target for the given compute variable.
   *
   * @param variable - The compute variable.
   * @return The current render target.
   */
  getCurrentRenderTarget(variable: VariableType): WebGLRenderTarget {
    return variable.renderTargets[variable.currentTextureIndex];
  }

  /**
   * Returns the alternate render target for the given compute variable.
   *
   * @param variable - The compute variable.
   * @return The alternate render target.
   */
  getAlternateRenderTarget(variable: VariableType): WebGLRenderTarget {
    return variable.renderTargets[variable.currentTextureIndex === 0 ? 1 : 0];
  }

  // The following functions can be used to compute things manually
  createShaderMaterial(
    computeFragmentShader: string,
    uniforms: { [Key: string]: Uniform<any> } = {},
  ) {
    const material = new ShaderMaterial({
      name: "GPUComputationShader",
      uniforms: uniforms,
      vertexShader: this.getPassThroughVertexShader(),
      fragmentShader: computeFragmentShader,
    });
    material.defines.resolution = `vec2(${this.textureSize.x.toFixed(1)}, ${this.textureSize.y.toFixed(1)})`;
    return material;
  }

  /**
   * Creates a new render target from the given parameters.
   *
   * @param textureSize - The size of the render target.
   * @param wrap - The wrapS/wrapT values.
   * @param minMagFilters - The minFilter/magFilter values.
   * @return The new render target.
   */
  createRenderTarget(
    textureSize: { x: number; y: number },
    wrap: {
      S: Wrapping | null;
      T: Wrapping | null;
    },
    minMagFilters: {
      min: MagnificationTextureFilter | null;
      mag: MagnificationTextureFilter | null;
    },
  ): WebGLRenderTarget {
    return new WebGLRenderTarget(textureSize.x, textureSize.y, {
      wrapS: wrap.S || ClampToEdgeWrapping,
      wrapT: wrap.T || ClampToEdgeWrapping,
      minFilter: minMagFilters.min || NearestFilter,
      magFilter: minMagFilters.mag || NearestFilter,
      format: RGBAFormat,
      type: this.dataType,
      depthBuffer: false,
    });
  }

  /**
   * Creates a new data texture.
   *
   * @return The new data texture.
   */
  createTexture(data: Float32Array | null = null): DataTexture {
    if (data !== null) {
      if (data.length !== this.textureSize.x * this.textureSize.y * 4) {
        throw new Error(
          `Invalid data length (${data.length}) for texture size ${this.textureSize.x} x ${this.textureSize.y}.`,
        );
      }
    }
    const textureData =
      data || new Float32Array(this.textureSize.x * this.textureSize.y * 4);
    const texture = new DataTexture(
      textureData,
      this.textureSize.x,
      this.textureSize.y,
      RGBAFormat,
      this.dataType,
    );
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Renders the given texture into the given render target.
   *
   * @param input - The input.
   * @param output - The output.
   */
  renderTexture(input: Texture, output: WebGLRenderTarget) {
    this.passThruUniforms.passThruTexture.value = input;
    this.doRenderTarget(this.passThruShader, output);
    this.passThruUniforms.passThruTexture.value = null;
  }

  /**
   * Renders the given material into the given render target
   * with a full-screen pass.
   *
   * @param material - The material.
   * @param output - The output.
   */
  doRenderTarget(material: Material, output: WebGLRenderTarget) {
    const currentRenderTarget = this.renderer.getRenderTarget();
    const currentXrEnabled = this.renderer.xr.enabled;
    const currentShadowAutoUpdate = this.renderer.shadowMap.autoUpdate;

    {
      this.renderer.xr.enabled = false; // Avoid camera modification
      this.renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows
      this.quad.material = material;
      this.renderer.setRenderTarget(output);
      this.quad.render(this.renderer);
      this.quad.material = this.passThruShader;
    }

    this.renderer.xr.enabled = currentXrEnabled;
    this.renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    this.renderer.setRenderTarget(currentRenderTarget);
  }

  /**
   * Update a given uniform for all shaders.
   *
   * @param uniformName - The name of the uniform to update.
   * @param value - The new value.
   */
  updateComputeUniforms(uniformName: string, value: any) {
    Object.values(this.shaders).forEach((shader) => {
      if (shader.material.uniforms[uniformName] !== undefined) {
        shader.material.uniforms[uniformName].value = value;
      }
    });
  }

  // Shaders
  getPassThroughVertexShader(): string {
    return `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;
  }

  getPassThroughFragmentShader(): string {
    return `
      uniform sampler2D passThruTexture;
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        gl_FragColor = texture2D(passThruTexture, uv);
      }
    `;
  }

  /**
   * Frees all internal resources. Call this method if you don't need the
   * renderer anymore.
   */
  destroy() {
    this.quad.dispose();
    Object.values(this.variables).forEach((variable) => {
      const renderTargets = variable.renderTargets;
      renderTargets.forEach((renderTarget) => {
        renderTarget.dispose();
      });
    });
    Object.values(this.shaders).forEach((shader) => {
      shader.material.dispose();
    });
  }
}
