import { BufferGeometry, BufferAttribute, Points } from "three";
import { Capitalize } from "./Snippets";
import GPGPUSystem from "./GPGPUSystem";
import { GPGPUSystemOptions } from "./GPGPUSystem";

interface ParticleSystemOptions extends GPGPUSystemOptions {
  count: number;
}

export default class ParticleSystem extends GPGPUSystem {
  public readonly count: number;
  public geometry: BufferGeometry;
  public points: Points;

  constructor(label: string, opts: ParticleSystemOptions) {
    super(label, opts);
    this.count = opts.count;

    this.geometry = new BufferGeometry();

    this.shaderMaterial.addUniform(
      `u${Capitalize(this.label)}Size`,
      0.07,
      true,
      "size",
      [0, 1, 0.01],
    );
    this.debugFolder = this.shaderMaterial.debugFolder;

    this.addAttribute("uv", 2, (x, y) => [
      (x + 0.5) / this.gpgpu.textureSize,
      (y + 0.5) / this.gpgpu.textureSize,
    ]);
    this.geometry.setDrawRange(0, this.count);

    this.points = new Points(this.geometry, this.shaderMaterial.instance);

    this.scene.add(this.points);
  }

  addAttribute(
    attribute: string,
    size: number,
    attributeBuilder: (x: number, y: number, i: number) => Array<number>,
  ) {
    const attrName = `a${Capitalize(this.label)}${Capitalize(attribute)}`;
    console.log(`Adding attribute ${attrName} to ParticleSystem ${this.label}`);
    const bufferArray = new Float32Array(this.count * size);
    for (let y = 0; y < this.gpgpu.textureSize; y++) {
      for (let x = 0; x < this.gpgpu.textureSize; x++) {
        const i = y * this.gpgpu.textureSize + x;
        const attr = attributeBuilder(x, y, i);
        if (attr.length !== size) {
          throw new Error(`attributeBuilder must return length ${size}`);
        }
        for (let k = 0; k < size; k++) {
          bufferArray[i * size + k] = attr[k];
        }
      }
    }
    this.geometry.setAttribute(
      `a${Capitalize(this.label)}${Capitalize(attribute)}`,
      new BufferAttribute(bufferArray, size),
    );
  }

  destroy() {
    super.destroy();
    this.geometry.dispose();
  }
}
