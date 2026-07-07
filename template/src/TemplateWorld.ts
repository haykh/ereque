import { World } from "ereque";
import type { WorldOptions } from "ereque";
import {
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
  DirectionalLight,
  AmbientLight,
} from "three";

export default class TemplateWorld extends World {
  private mesh: Mesh | null = null;

  constructor(opts: WorldOptions) {
    super(opts);
  }

  protected override initialize() {
    const key = new DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    this.scene.add(key, new AmbientLight(0xffffff, 0.6));

    this.mesh = new Mesh(
      new SphereGeometry(1, 32, 32),
      new MeshStandardMaterial({ color: 0x00ff00 }),
    );

    this.scene.add(this.mesh);
  }

  public override update() {
    if (!this.mesh) {
      return;
    }
    this.mesh.position.y = Math.sin(this.time.elapsedSec) * 2;
  }

  destroy() {
    super.destroy();
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as MeshStandardMaterial).dispose();
    }
  }
}
