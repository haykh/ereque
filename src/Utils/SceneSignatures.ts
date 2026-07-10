import type {
  Scene,
  Mesh,
  BufferAttribute,
  Material,
  DirectionalLight,
  PointLight,
  AmbientLight,
} from "three";
import { Vector3 } from "three";

export const SceneMeshSignature = (scene: Scene): string => {
  const parts: string[] = [];
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const pos = g.attributes.position as BufferAttribute;
    const matKey = Array.isArray(m.material)
      ? m.material.map((mm) => mm.uuid).join(",")
      : (m.material as Material).uuid;
    parts.push(
      `${m.id}:${g.uuid}:${pos.version}:${m.matrixWorld.elements.join(",")}:${matKey}`,
    );
  });
  return parts.join("|");
};

export const SceneLightSignature = (scene: Scene): string => {
  const parts: string[] = [];
  const p = new Vector3(),
    t = new Vector3();
  scene.traverse((o) => {
    if ((o as DirectionalLight).isDirectionalLight) {
      const l = o as DirectionalLight;
      l.getWorldPosition(p);
      (l as DirectionalLight).target.getWorldPosition(t);
      parts.push(
        `D:${l.id}:${p.toArray()}:${t.toArray()}:${l.color.getHex()}:${l.intensity}`,
      );
    } else if ((o as PointLight).isPointLight) {
      const l = o as PointLight;
      l.getWorldPosition(p);
      parts.push(`P:${l.id}:${p.toArray()}:${l.color.getHex()}:${l.intensity}`);
    } else if ((o as AmbientLight).isAmbientLight) {
      const l = o as AmbientLight;
      parts.push(`A:${l.id}:${l.color.getHex()}:${l.intensity}`);
    }
  });
  return parts.join("|");
};
