import { ShaderMaterial, Uniform, Color } from "three";
import { type GUI } from "three/addons/libs/lil-gui.module.min.js";

interface CustomShaderMaterialOptions {
  vertexShader: string;
  fragmentShader: string;
  debug: { active: boolean; getUI: () => GUI };
  sizes: {
    width: number;
    height: number;
    pixelResolution: { x: number; y: number };
  };
}

export default class CustomShaderMaterial {
  public readonly label: string;

  private sizes: {
    width: number;
    height: number;
    pixelResolution: { x: number; y: number };
  };

  public debugFolder: GUI | null = null;
  public instance: ShaderMaterial;

  constructor(label: string, opts: CustomShaderMaterialOptions) {
    this.label = label;
    this.sizes = opts.sizes;
    if (opts.debug.active) {
      this.debugFolder = opts.debug.getUI().addFolder(this.label);
    }

    this.instance = new ShaderMaterial({
      vertexShader: opts.vertexShader,
      fragmentShader: opts.fragmentShader,
      uniforms: {
        uTime: new Uniform(0),
        uResolution: new Uniform(this.sizes.pixelResolution),
      },
    });
  }

  addUniform(
    name: string,
    value: any,
    addUI: boolean = true,
    label: string | undefined = undefined,
    options: Array<number> = [],
    listen: boolean = false,
  ) {
    console.log(`Adding uniform ${name} to CustomShaderMaterial ${this.label}`);
    this.instance.uniforms[name] = new Uniform(value);
    if (!addUI) return;
    this.debugFolder
      ?.add(this.instance.uniforms[name], "value", ...options)
      .name(label || name)
      .listen(listen);
  }

  addColorUniform(
    name: string,
    value: string,
    addUI: boolean = true,
    label: string | undefined = undefined,
  ) {
    const colorParam = { value: value };
    this.instance.uniforms[name] = new Uniform(new Color(value));
    if (!addUI) return;
    this.debugFolder
      ?.addColor(colorParam, "value")
      .name(label || name)
      .onChange(() => {
        this.instance.uniforms[name].value.set(new Color(colorParam.value));
      });
  }

  update(time: { elapsedSec: number }) {
    this.instance.uniforms.uTime.value = time.elapsedSec;
  }

  destroy() {
    this.instance.dispose();
  }
}
