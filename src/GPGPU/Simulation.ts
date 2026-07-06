import type { WebGLRenderer, Scene, Texture } from "three";
import { Uniform } from "three";
import { type GUI } from "three/addons/libs/lil-gui.module.min.js";
import GPGPU from "./GPGPU";
import { GPGPUGridRenderer2D, GPGPUParticleRenderer } from "./GPGPURenderer";

export interface SimulationOptions {
  time: {
    elapsedSec: number;
  };
  sizes: {
    pixelResolution: { x: number; y: number };
  };
  renderer: WebGLRenderer;
  scene: Scene;
  debug: { active: boolean; getUI: () => GUI };
}

const Colormaps = ["turbo", "viridis", "inferno", "fire", "bipolar", "seismic"];

class Simulation {
  public readonly gpgpu: GPGPU;
  public readonly gpgpuTextureSize: { x: number; y: number };
  public readonly debugFolder: GUI | null = null;

  constructor(
    gpgpuTextureSize: { x: number; y: number },
    opts: SimulationOptions,
  ) {
    this.gpgpuTextureSize = gpgpuTextureSize;
    this.gpgpu = new GPGPU(this.gpgpuTextureSize, opts.renderer);

    if (opts.debug.active) {
      this.debugFolder = opts.debug.getUI().addFolder("simulation");
    }
  }

  init(initValues: { [Key: string]: Texture } = {}) {
    this.gpgpu.init(initValues);
  }

  destroy() {
    this.debugFolder?.destroy();
    this.gpgpu.destroy();
  }
}

export class GridSimulation extends Simulation {
  public readonly gridRenderer2D: GPGPUGridRenderer2D;
  public readonly colormap: {
    vmin: number;
    vmax: number;
    map: (typeof Colormaps)[number];
    reverse: boolean;
  };

  constructor(
    gpgpuTextureSize: { x: number; y: number },
    shaders: {
      displayVertexShader: string;
      displayFragmentShader: string;
    },
    opts: SimulationOptions,
    colormap: {
      vmin: number;
      vmax: number;
      map: (typeof Colormaps)[number];
      reverse: boolean;
    } = {
      vmin: 0.0,
      vmax: 1.0,
      map: "turbo",
      reverse: false,
    },
  ) {
    super(gpgpuTextureSize, opts);
    this.colormap = colormap;

    this.gridRenderer2D = new GPGPUGridRenderer2D("fluid", {
      debug: opts.debug,
      scene: opts.scene,
      gpgpu: this.gpgpu,
      displayVertexShader: shaders.displayVertexShader,
      displayFragmentShader: shaders.displayFragmentShader,
      pixelResolution: opts.sizes.pixelResolution,
      uniforms: {
        uColormapVmin: new Uniform(this.colormap.vmin),
        uColormapVmax: new Uniform(this.colormap.vmax),
        uColormap: new Uniform(Colormaps.indexOf(this.colormap.map)),
        uColormapReverse: new Uniform(this.colormap.reverse),
      },
    });

    this.gridRenderer2D.debugFolder
      ?.add(this.colormap, "vmin", -5.0, 5.0, 0.01)
      .name("colormap min")
      .onChange((v) => {
        this.gridRenderer2D.displayShaderMaterial.uniforms.uColormapVmin.value =
          v;
      });
    this.gridRenderer2D.debugFolder
      ?.add(this.colormap, "vmax", -5.0, 5.0, 0.01)
      .name("colormap max")
      .onChange((v) => {
        this.gridRenderer2D.displayShaderMaterial.uniforms.uColormapVmax.value =
          v;
      });
    this.gridRenderer2D.debugFolder
      ?.add(this.colormap, "map", Colormaps)
      .name("colormap")
      .onChange((v) => {
        this.gridRenderer2D.displayShaderMaterial.uniforms.uColormap.value =
          Colormaps.indexOf(v);
      });
    this.gridRenderer2D.debugFolder
      ?.add(this.colormap, "reverse")
      .name("colormap reverse")
      .onChange((v) => {
        this.gridRenderer2D.displayShaderMaterial.uniforms.uColormapReverse.value =
          v;
      });
  }

  destroy() {
    this.gridRenderer2D.destroy();
    super.destroy();
  }
}

export class ParticleSimulation extends Simulation {
  public readonly particleRenderer: GPGPUParticleRenderer;
  public nparticles: number;

  constructor(
    nparticles: number,
    shaders: {
      displayVertexShader: string;
      displayFragmentShader: string;
    },
    opts: SimulationOptions,
  ) {
    const textureSize = Math.ceil(Math.sqrt(nparticles));
    super({ x: textureSize, y: textureSize }, opts);
    this.nparticles = nparticles;

    this.particleRenderer = new GPGPUParticleRenderer("particles", {
      debug: opts.debug,
      scene: opts.scene,
      gpgpu: this.gpgpu,
      displayVertexShader: shaders.displayVertexShader,
      displayFragmentShader: shaders.displayFragmentShader,
      pixelResolution: opts.sizes.pixelResolution,
      nparticles: this.nparticles,
    });
  }

  destroy() {
    this.particleRenderer.destroy();
    super.destroy();
  }
}
