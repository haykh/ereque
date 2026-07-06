import { Uniform, type Scene, type DataTexture } from "three";
import { type Variable } from "three/examples/jsm/misc/GPUComputationRenderer";
import type GPGPU from "./GPGPU";
import { type GUI } from "three/examples/jsm/libs/lil-gui.module.min";
import CustomShaderMaterial from "./CustomShaderMaterial";
import type Debug from "./Debug";
import type Sizes from "./Sizes";
import type Time from "./Time";
import { Capitalize } from "./Snippets";

export interface GPGPUSystemOptions {
  debug: Debug;
  sizes: Sizes;
  scene: Scene;

  gpgpu: GPGPU;
  displayVertexShader: string;
  displayFragmentShader: string;
}

export default class GPGPUSystem {
  public readonly label: string;

  protected sizes: Sizes;
  protected scene: Scene;
  protected gpgpu: GPGPU;

  public debugFolder: GUI | null = null;

  public variables: { [Key: string]: Variable } = {};
  public shaderMaterial: CustomShaderMaterial;

  constructor(label: string, opts: GPGPUSystemOptions) {
    this.label = label;
    this.sizes = opts.sizes;
    this.scene = opts.scene;

    this.gpgpu = opts.gpgpu;

    this.shaderMaterial = new CustomShaderMaterial(this.label, {
      vertexShader: opts.displayVertexShader,
      fragmentShader: opts.displayFragmentShader,
      ...opts,
    });

    this.debugFolder = this.shaderMaterial.debugFolder;
  }

  addVariable(variable: string, initTexture: DataTexture, shader: string) {
    const varName = `u${Capitalize(this.label)}${Capitalize(variable)}`;
    console.log(
      `Adding variable ${variable} : ${varName} to GPGPUSystem ${this.label}`,
    );
    this.variables[variable] = this.gpgpu.instance.addVariable(
      `u${Capitalize(this.label)}${Capitalize(variable)}`,
      shader,
      initTexture,
    );
    this.addComputeShaderUniform(variable, "uTime", 0);
    this.shaderMaterial.addUniform(
      `u${Capitalize(this.label)}${Capitalize(variable)}Texture`,
      null,
      false,
    );
  }

  setVariableDependencies(varname: string, dependencies: Array<string>) {
    this.gpgpu.instance.setVariableDependencies(
      this.variables[varname],
      dependencies.map((depname: string) => this.variables[depname]),
    );
  }

  addComputeShaderUniform(
    variable: string,
    name: string,
    value: any,
    addUI: boolean = false,
    label: string | null = null,
    options: Array<number> = [],
    listen: boolean = false,
  ) {
    console.log(`Adding uniform ${name} to GPGPUSystem ${this.label}`);
    this.variables[variable].material.uniforms[name] = new Uniform(value);
    if (addUI) {
      this.debugFolder
        ?.add(
          this.variables[variable].material.uniforms[name],
          "value",
          ...options,
        )
        .name(label || name)
        .listen(listen);
    }
  }

  setComputeShaderUniform(variable: string, name: string, value: any) {
    this.variables[variable].material.uniforms[name].value = value;
  }

  update(time: Time) {
    this.shaderMaterial.update(time);
    Object.entries(this.variables).forEach(([varname, _]) => {
      this.setComputeShaderUniform(varname, "uTime", time.elapsedSec);
    });
  }

  syncFBO() {
    Object.entries(this.variables).forEach(([varlabel, variable]) => {
      this.shaderMaterial.instance.uniforms[
        `u${Capitalize(this.label)}${Capitalize(varlabel)}Texture`
      ].value = this.gpgpu.instance.getCurrentRenderTarget(variable).texture;
    });
  }

  destroy() {
    this.shaderMaterial.destroy();
  }
}
