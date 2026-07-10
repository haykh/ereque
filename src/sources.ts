export type SourceType =
  "cubeTexture" | "gltfModel" | "texture" | "hdrTexture" | "exrTexture";

export type Source = {
  name: string;
  type: SourceType;
  paths: string[];
};

export type SourceList = ReadonlyArray<Source>;
