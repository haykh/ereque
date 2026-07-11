import type { DataTexture } from "three";
import { LinearFilter, RepeatWrapping, ClampToEdgeWrapping } from "three";

import CustomShaderMaterial from "../../Utils/CustomShaderMaterial";
import {
  GLSLShaderChunk,
  GLSLUniform,
  GLSLFunction,
} from "../../Utils/ShaderTemplate";

export interface EnvironmentMapOptions {
  traceMaterial: CustomShaderMaterial;
  texture?: DataTexture | null;
}

export default class EnvironmentMap {
  private traceMaterial: CustomShaderMaterial;

  constructor(opts: EnvironmentMapOptions) {
    this.traceMaterial = opts.traceMaterial;
    this.traceMaterial.addUniform("uEnvMap", null, false);
    if (opts.texture) {
      this.setTexture(opts.texture);
    }
  }

  public setTexture(texture: DataTexture): void {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    this.traceMaterial.instance.uniforms.uEnvMap.value = texture;
  }

  public static ShaderChunk(): GLSLShaderChunk {
    const uniforms = [new GLSLUniform("sampler2D", "uEnvMap")];

    const envColor = new GLSLFunction(
      "vec3",
      "envColor",
      ["in vec3 dir"],
      [
        "vec3  d = normalize(dir);",
        "const float RECIP_PI  = 0.3183098861837907;",
        "const float RECIP_2PI = 0.15915494309189535;",
        "vec2  uv = vec2(atan(d.z, d.x) * RECIP_2PI + 0.5,",
        "                asin(clamp(d.y, -1.0, 1.0)) * RECIP_PI + 0.5);",
        "return texture(uEnvMap, uv).rgb;",
      ],
    );

    return new GLSLShaderChunk(uniforms, [], [], [envColor]);
  }
}
