import type { Material, BufferGeometry, Texture, Object3D } from "three";
import {
  Mesh,
  Line,
  LineSegments,
  LineLoop,
  Points,
  ShaderMaterial,
  SkinnedMesh,
} from "three";

const isTexture = (v: unknown): v is Texture =>
  !!v && typeof v === "object" && (v as Texture).isTexture === true;

const disposeMaterial = (mat: Material, disposedTextures: Set<Texture>) => {
  for (const value of Object.values(
    mat as unknown as Record<string, unknown>,
  )) {
    if (isTexture(value) && !disposedTextures.has(value)) {
      value.dispose();
      disposedTextures.add(value);
    }
  }

  if (mat instanceof ShaderMaterial) {
    for (const u of Object.values(mat.uniforms)) {
      const val = u?.value;
      if (isTexture(val) && !disposedTextures.has(val)) {
        val.dispose();
        disposedTextures.add(val);
      }
    }
  }

  mat.dispose();
};

const disposeMaterialLike = (
  material: Material | Material[] | undefined,
  disposedMaterials: Set<Material>,
  disposedTextures: Set<Texture>,
) => {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const m of material) {
      if (!disposedMaterials.has(m)) {
        disposeMaterial(m, disposedTextures);
        disposedMaterials.add(m);
      }
    }
  } else {
    if (!disposedMaterials.has(material)) {
      disposeMaterial(material, disposedTextures);
      disposedMaterials.add(material);
    }
  }
};

export default function DisposeScene(scene: Object3D) {
  const disposedGeometries = new Set<BufferGeometry>();
  const disposedMaterials = new Set<Material>();
  const disposedTextures = new Set<Texture>();

  scene.traverse((obj) => {
    if (
      obj instanceof Mesh ||
      obj instanceof Line ||
      obj instanceof LineSegments ||
      obj instanceof LineLoop ||
      obj instanceof Points
    ) {
      const geom = obj.geometry as BufferGeometry | undefined;
      if (geom && !disposedGeometries.has(geom)) {
        geom.dispose();
        disposedGeometries.add(geom);
      }
      disposeMaterialLike(
        obj.material as Material | Material[] | undefined,
        disposedMaterials,
        disposedTextures,
      );
    }

    if (obj instanceof SkinnedMesh) {
      obj.skeleton?.dispose?.();
    }
  });
}
