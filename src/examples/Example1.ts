import { Mesh, SphereGeometry } from "three";
import { World } from "../World";
import type { WorldOptions } from "../World";
import CustomShaderMaterial from "../Utils/CustomShaderMaterial";

/*
 * Example with custom shader material
 */
import vertexShader from "./shaders/shader.vert";
import fragmentShader from "./shaders/shader.frag";

export default class Example extends World {
  public shader_material: CustomShaderMaterial | null = null;

  constructor(opts: WorldOptions) {
    super(opts);
  }

  initialize() {
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

  update() {
    super.update();
    this.shader_material?.update(this.time);
  }

  destroy() {
    this.shader_material?.destroy();
  }
}
