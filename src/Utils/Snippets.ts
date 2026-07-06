import type { Mesh } from "three";
import { MeshStandardMaterial } from "three";

export const EnableCastReceiveShadows = (model: Mesh) => {
  if (model.material instanceof MeshStandardMaterial) {
    model.castShadow = true;
    model.receiveShadow = true;
    model.material.needsUpdate = true;
  } else {
    throw new Error("Model material is not MeshStandardMaterial");
  }
};

export const ShaderHookAfter = (
  shader: string,
  statement: string,
  snippet: string,
): string => {
  return shader.replace(statement, statement + "\n" + snippet);
};

export const Capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};
