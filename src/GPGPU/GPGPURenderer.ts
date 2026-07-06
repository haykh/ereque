import type { Scene } from "three";
import {
  Uniform,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  DoubleSide,
  BufferGeometry,
  BufferAttribute,
  Points,
} from "three";
import { type GUI } from "three/addons/libs/lil-gui.module.min.js";
import type GPUComputationRenderer from "./GPGPU";

export interface GPGPURendererOptions {
  scene: Scene;
  gpgpu: GPUComputationRenderer;
  debug: { active: boolean; getUI: () => GUI };

  displayVertexShader: string;
  displayFragmentShader: string;

  pixelResolution: { x: number; y: number };
  uniforms?: { [key: string]: Uniform };
}

export default class GPGPURenderer {
  public readonly label: string;

  protected readonly scene: Scene;
  protected readonly gpgpu: GPUComputationRenderer;

  public readonly debugFolder: GUI | null = null;
  public readonly displayShaderMaterial: ShaderMaterial;
  public readonly displayVariables: Array<string> = [];

  constructor(label: string, opts: GPGPURendererOptions) {
    this.label = label;
    this.scene = opts.scene;
    this.gpgpu = opts.gpgpu;

    if (opts.debug.active) {
      this.debugFolder = opts.debug.getUI().addFolder(this.label);
    }

    this.displayShaderMaterial = new ShaderMaterial({
      vertexShader: opts.displayVertexShader,
      fragmentShader: opts.displayFragmentShader,
      uniforms: {
        uTime: new Uniform(0),
        uResolution: new Uniform(opts.pixelResolution),
        ...opts.uniforms,
      },
    });
  }

  addDisplayVariable(variable: string) {
    console.log(`RENDERER: uniform u${variable} added`);
    this.displayVariables.push(variable);
    this.displayShaderMaterial.uniforms[`u${variable}`] = new Uniform(null);
  }

  render(time: { elapsedSec: number }) {
    this.displayVariables.forEach((varlabel) => {
      const gpgpuVariable = this.gpgpu.variables[varlabel];
      if (gpgpuVariable === undefined) {
        throw new Error(
          `GPGPU variable u${varlabel} not found when rendering textures`,
        );
      }
      this.displayShaderMaterial.uniforms[`u${varlabel}`].value =
        this.gpgpu.getCurrentRenderTarget(gpgpuVariable).texture;
    });
    this.displayShaderMaterial.uniforms.uTime.value = time.elapsedSec;
  }

  destroy() {
    this.debugFolder?.destroy();
    this.displayShaderMaterial.dispose();
  }
}

export class GPGPUGridRenderer2D extends GPGPURenderer {
  public readonly mesh: Mesh;

  constructor(label: string, opts: GPGPURendererOptions) {
    super(label, opts);
    this.displayShaderMaterial.side = DoubleSide;

    this.mesh = new Mesh(
      new PlaneGeometry(
        (2 * this.gpgpu.textureSize.x) / this.gpgpu.textureSize.y,
        2,
        1,
        1,
      ),
      this.displayShaderMaterial,
    );
    this.scene.add(this.mesh);
  }

  destroy() {
    this.mesh.geometry.dispose();
    super.destroy();
  }
}

interface ParticleRendererOptions extends GPGPURendererOptions {
  nparticles: number;
}

export class GPGPUParticleRenderer extends GPGPURenderer {
  public nparticles: number;
  public bufferGeometry = new BufferGeometry();
  public points: Points;

  constructor(label: string, opts: ParticleRendererOptions) {
    super(label, opts);
    this.nparticles = opts.nparticles;
    this.bufferGeometry.setDrawRange(0, this.nparticles);

    const uvArray = new Float32Array(
      this.gpgpu.textureSize.x * this.gpgpu.textureSize.y * 2,
    );
    for (let y = 0; y < this.gpgpu.textureSize.y; y++) {
      for (let x = 0; x < this.gpgpu.textureSize.x; x++) {
        const i = x + y * this.gpgpu.textureSize.x;
        uvArray[i * 2 + 0] = (x + 0.5) / this.gpgpu.textureSize.x;
        uvArray[i * 2 + 1] = (y + 0.5) / this.gpgpu.textureSize.y;
      }
    }
    this.bufferGeometry.setAttribute(`aUV`, new BufferAttribute(uvArray, 2));

    this.displayShaderMaterial.uniforms["uSize"] = new Uniform(5);
    this.displayShaderMaterial.uniforms["uTextureSize"] = new Uniform(
      this.gpgpu.textureSize,
    );
    this.debugFolder
      ?.add(this.displayShaderMaterial.uniforms.uSize, "value", 0.1, 10)
      .name("point size");

    this.points = new Points(this.bufferGeometry, this.displayShaderMaterial);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  destroy() {
    this.bufferGeometry.dispose();
    super.destroy();
  }
}
