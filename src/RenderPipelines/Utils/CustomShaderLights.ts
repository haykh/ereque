import type { Scene, PointLight, DirectionalLight, AmbientLight } from "three";
import { Vector3 } from "three";

import type CustomShaderMaterial from "../../Utils/CustomShaderMaterial";
import { glsl } from "../../glsl";

const MAX_LIGHTS = 64;

export interface CustomShaderLightsOptions {
  scene: Scene;
  traceMaterial: CustomShaderMaterial;
}

/**
 * Utility class to extract lights from a Three.js scene and provide shader functions for direct lighting.
 *
 * Shader provides:
 *
 * - `vec3 directLighting(pos, n, viewDir)` returns the direct lighting contribution at a point with normal `n` and view direction `viewDir`.
 * - Supports directional lights, point lights, and ambient light.
 * - Requires an `occluded(origin, dir, maxDist)` function to be provided in the shader for shadow testing.
 */
export default class CustomShaderLights {
  private scene: Scene;
  private traceMaterial: CustomShaderMaterial;
  private lights: {
    directional: {
      uniformPrefix: string;
      to: Array<Vector3>;
      color: Array<Vector3>;
      intensity: Array<number>;
      number: number;
    };
    point: {
      uniformPrefix: string;
      position: Array<Vector3>;
      color: Array<Vector3>;
      intensity: Array<number>;
      number: number;
    };
    ambient: {
      uniformPrefix: string;
      color: Vector3;
      intensity: number;
    };
  };

  private dirty = true;

  constructor(opts: CustomShaderLightsOptions) {
    this.scene = opts.scene;
    this.traceMaterial = opts.traceMaterial;

    this.lights = {
      directional: {
        uniformPrefix: "uDirectionalLights",
        to: Array.from({ length: MAX_LIGHTS }, () => new Vector3()),
        color: Array.from({ length: MAX_LIGHTS }, () => new Vector3()),
        intensity: Array.from({ length: MAX_LIGHTS }, () => 0.0),
        number: 0,
      },
      point: {
        uniformPrefix: "uPointLights",
        position: Array.from({ length: MAX_LIGHTS }, () => new Vector3()),
        color: Array.from({ length: MAX_LIGHTS }, () => new Vector3()),
        intensity: Array.from({ length: MAX_LIGHTS }, () => 0.0),
        number: 0,
      },
      ambient: {
        uniformPrefix: "uAmbientLight",
        color: new Vector3(),
        intensity: 0.0,
      },
    };

    for (const lightType of ["directional", "point", "ambient"] as const) {
      const lightData = this.lights[lightType];
      const prefix = lightData.uniformPrefix;
      for (const key of Object.keys(lightData)) {
        if (key === "uniformPrefix") {
          continue;
        }
        const value = lightData[key as keyof typeof lightData];
        this.traceMaterial.addUniform(
          `${prefix}${key.charAt(0).toUpperCase() + key.slice(1)}`,
          value,
          false,
        );
      }
    }
  }

  public build(): void {
    this.scene.updateMatrixWorld(true);
    this.lights.directional.number = 0;
    this.lights.point.number = 0;
    this.lights.ambient.intensity = 0.0;

    this.scene.traverse((o) => {
      if ((o as DirectionalLight).isDirectionalLight) {
        if (this.lights.directional.number >= MAX_LIGHTS) {
          console.warn(
            `Maximum number of directional lights (${MAX_LIGHTS}) exceeded.`,
          );
          return;
        }
        const dl = o as DirectionalLight;
        this.lights.directional.to[this.lights.directional.number].copy(
          dl
            .getWorldPosition(new Vector3())
            .sub(dl.target.getWorldPosition(new Vector3()))
            .normalize(),
        );
        this.lights.directional.color[
          this.lights.directional.number
        ].setFromColor(dl.color);
        this.lights.directional.intensity[this.lights.directional.number] =
          dl.intensity;
        this.lights.directional.number++;
      }
      if ((o as PointLight).isPointLight) {
        if (this.lights.point.number >= MAX_LIGHTS) {
          console.warn(
            `Maximum number of point lights (${MAX_LIGHTS}) exceeded.`,
          );
          return;
        }
        const pl = o as PointLight;
        this.lights.point.position[this.lights.point.number].copy(
          pl.getWorldPosition(new Vector3()),
        );
        this.lights.point.color[this.lights.point.number].setFromColor(
          pl.color,
        );
        this.lights.point.intensity[this.lights.point.number] = pl.intensity;
        this.lights.point.number++;
      }
      if ((o as AmbientLight).isAmbientLight) {
        this.lights.ambient.color.setFromColor((o as AmbientLight).color);
        this.lights.ambient.intensity = (o as AmbientLight).intensity;
      }
    });

    const u = this.traceMaterial.instance.uniforms;
    u.uDirectionalLightsTo.value = this.lights.directional.to;
    u.uDirectionalLightsColor.value = this.lights.directional.color;
    u.uDirectionalLightsIntensity.value = this.lights.directional.intensity;
    u.uDirectionalLightsNumber.value = this.lights.directional.number;

    u.uPointLightsPosition.value = this.lights.point.position;
    u.uPointLightsColor.value = this.lights.point.color;
    u.uPointLightsIntensity.value = this.lights.point.intensity;
    u.uPointLightsNumber.value = this.lights.point.number;

    u.uAmbientLightColor.value = this.lights.ambient.color;
    u.uAmbientLightIntensity.value = this.lights.ambient.intensity;
  }

  public isDirty(): boolean {
    return this.dirty;
  }

  public markForRebuild(): void {
    this.dirty = true;
  }

  public rebuildIfNecessary(): boolean {
    if (this.dirty) {
      this.build();
      this.dirty = false;
      return true;
    }
    return false;
  }
}

const PREAMBLE = glsl`
// Directional lights
uniform int   uDirectionalLightsNumber;
uniform vec3  uDirectionalLightsTo[${MAX_LIGHTS}];
uniform vec3  uDirectionalLightsColor[${MAX_LIGHTS}];
uniform float uDirectionalLightsIntensity[${MAX_LIGHTS}];

// Point lights
uniform int   uPointLightsNumber;
uniform vec3  uPointLightsPosition[${MAX_LIGHTS}];
uniform vec3  uPointLightsColor[${MAX_LIGHTS}];
uniform float uPointLightsIntensity[${MAX_LIGHTS}];

// Ambient light
uniform vec3  uAmbientLightColor;
uniform float uAmbientLightIntensity;

vec3 ambientLight(in float lightIntensity, in vec3 lightColor) {
  return lightColor * lightIntensity;
}

vec3 directionalLight(in float lightIntensity,
                      in vec3  lightColor,
                      in vec3  lightDir,
                      in vec3  normal) {
  return lightColor * lightIntensity * max(0.0, dot(normal, normalize(lightDir)));
}

vec3 pointLight(in float lightIntensity,
                in float lightFalloff,
                in vec3  lightColor,
                in vec3  lightPosition,
                in vec3  normal,
                in vec3  fragmentPosition) {
  vec3  delta   = lightPosition - fragmentPosition;
  vec3  dir     = normalize(delta);
  float falloff = max(0.0, 1.0 - length(delta) * lightFalloff);
  return lightColor * lightIntensity * falloff * max(0.0, dot(normal, dir));
}

// "occluded" function must be provided

vec3 directLighting(in vec3 pos, in vec3 n, in vec3 viewDir) {
  vec3 sum = ambientLight(uAmbientLightIntensity,
                          uAmbientLightColor); // unshadowed fill
  vec3 o   = pos + n * 1e-3;                   // offset off the surface

  for (int i = 0; i < uDirectionalLightsNumber; i++) {
    vec3 L = uDirectionalLightsTo[i];
    if (!occluded(o, L, INFINITY)) {
      sum += directionalLight(uDirectionalLightsIntensity[i],
                              uDirectionalLightsColor[i],
                              L,
                              n);
    }
  }
  for (int i = 0; i < uPointLightsNumber; i++) {
    vec3  d    = uPointLightsPosition[i] - pos;
    float dist = length(d);
    if (!occluded(o, d / dist, dist - 1e-3)) { // occluders only *before* the light
      sum += pointLight(uPointLightsIntensity[i],
                        0.0,
                        uPointLightsColor[i],
                        uPointLightsPosition[i],
                        n,
                        pos);
    }
  }
  return sum;
}
`;

export const prependCustomShaderLightsPreamble = (
  sceneShaderBody: string,
) => glsl`
${PREAMBLE}
${sceneShaderBody}
`;
