import { Mesh, PlaneGeometry } from "three";
import GPGPUSystem from "./GPGPUSystem";
import { GPGPUSystemOptions } from "./GPGPUSystem";

interface GridSystem2DOptions extends GPGPUSystemOptions {
  sizeX: number;
  sizeY: number;
}

export default class GridSystem2D extends GPGPUSystem {
  public readonly sizeX: number;
  public readonly sizeY: number;

  public mesh: Mesh;

  constructor(label: string, opts: GridSystem2DOptions) {
    super(label, opts);
    this.sizeX = opts.sizeX;
    this.sizeY = opts.sizeY;

    this.mesh = new Mesh(
      new PlaneGeometry((2 * this.sizeX) / this.sizeY, 2, 1, 1),
      this.shaderMaterial.instance,
    );
    this.scene.add(this.mesh);
  }

  destroy() {
    super.destroy();
    this.mesh.geometry.dispose();
  }
}
