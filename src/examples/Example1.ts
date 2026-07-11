import { Mesh, SphereGeometry } from "three";

import type { WorldOptions } from "ereque";
import { World, CustomShaderMaterial } from "ereque";

/*
 * Example with custom shader material
 */
import vertexShader from "./shaders/example1/shader.vert";
import fragmentShader from "./shaders/example1/shader.frag";

export default class Example extends World {
  public shader_material: CustomShaderMaterial | null = null;

  constructor(opts: WorldOptions) {
    super(opts);
  }

  public override initialize(): void {
    this.shader_material = new CustomShaderMaterial("shader material", {
      vertexShader,
      fragmentShader,
      ...this.opts(),
    });
    const sphere = new Mesh(
      new SphereGeometry(1, 32, 32),
      this.shader_material.instance,
    );
    this.scene.add(sphere);
  }

  public override update(): void {
    this.shader_material?.update(this.time);
  }

  public override destroy(): void {
    super.destroy();
    this.shader_material?.destroy();
  }
}
