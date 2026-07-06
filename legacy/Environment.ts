import { AmbientLight, DirectionalLight, type Texture } from "three";
import WorldObject, { type WorldObjectOptions } from "./WorldObject";

interface EnvironmentOptions extends WorldObjectOptions {}

export default class Environment extends WorldObject {
  public directionalLight: DirectionalLight | null = null;
  public ambientLight: AmbientLight | null = null;

  constructor(opts: EnvironmentOptions) {
    super("environment", opts);

    // this.directionalLight = new DirectionalLight("#ffffff", 2);
    // this.directionalLight.castShadow = true;
    // this.directionalLight.shadow.camera.far = 15;
    // this.directionalLight.shadow.mapSize.set(1 << 10, 1 << 10);
    // this.directionalLight.shadow.normalBias = 0.05;
    // this.directionalLight.position.set(3.5, 2, -1.24);
    // this.scene.add(this.directionalLight);

    // this.ambientLight = new AmbientLight("#ffffff", 1);
    // this.scene.add(this.ambientLight);

    this.scene.environment = this.resources.items
      ?.environmentMapTexture as Texture;
    this.scene.environmentIntensity = 0.5;

    if (this.resources.items.environmentMapTexture !== undefined) {
      this.debugFolder
        ?.add(this.scene, "environmentIntensity")
        .name("envMapIntensity")
        .min(0)
        .max(4)
        .step(0.001);
    }
    if (this.directionalLight !== null) {
      this.debugFolder
        ?.add(this.directionalLight, "intensity")
        .name("dirLightIntensity")
        .min(0)
        .max(10)
        .step(0.001);
    }
    if (this.ambientLight !== null) {
      this.debugFolder
        ?.add(this.ambientLight, "intensity")
        .name("ambientIntensity")
        .min(0)
        .max(10)
        .step(0.001);
    }
  }

  destroy() {
    super.destroy();
    (this.scene?.environment as Texture)?.dispose();
    this.directionalLight?.shadow.map?.dispose();
  }
}
