import {
  TextureLoader,
  CubeTextureLoader,
  DataTexture,
  Texture,
  CubeTexture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import EventEmitter from "./EventEmitter";
import type { Source, SourceList } from "../sources";

interface Loaders {
  textureLoader: TextureLoader;
  cubeTextureLoader: CubeTextureLoader;
  hdrLoader: HDRLoader;
  dracoLoader: DRACOLoader;
  gltfLoader: GLTFLoader;
}
type Asset = Texture | CubeTexture | DataTexture | GLTF;
interface AssetList {
  [Key: string]: Asset;
}

export default class Resources extends EventEmitter {
  public readonly sources: SourceList;
  private loaders: Loaders;

  public isReady: boolean = false;
  public readonly toLoad: number;
  public loaded: number;
  public items: AssetList;

  constructor(sources: SourceList) {
    super();

    this.sources = sources;

    this.loaders = {
      textureLoader: new TextureLoader(),
      cubeTextureLoader: new CubeTextureLoader(),
      hdrLoader: new HDRLoader(),
      dracoLoader: new DRACOLoader(),
      gltfLoader: new GLTFLoader(),
    };

    this.loaders.dracoLoader.setDecoderPath("/draco/");
    this.loaders.gltfLoader.setDRACOLoader(this.loaders.dracoLoader);

    this.toLoad = this.sources.length;
    this.loaded = 0;
    this.items = {};
    if (this.toLoad === 0) {
      this.isReady = true;
    } else {
      this.startLoading();
    }
  }

  startLoading() {
    const onProgress = (name: string) => (progress: ProgressEvent) => {
      console.log(
        `Loading asset ${name}: ${Math.round((100 * progress.loaded) / progress.total)}%`
      );
    };
    const onError = (name: string) => (err: unknown) => {
      console.error(`Error loading asset ${name}: ${err}`);
    };
    this.sources.forEach((source) => {
      const type = source.type;
      const name = source.name;
      const paths = source.paths;
      if (type === "texture") {
        if (paths.length === 0) {
          throw new Error(`No path provided for the ${name} source`);
        }
        this.loaders.textureLoader.load(
          paths[0],
          (file) => {
            this.sourceLoaded(source, file);
          },
          onProgress(name),
          onError(name)
        );
      } else if (type === "cubeTexture") {
        this.loaders.cubeTextureLoader.load(
          paths,
          (file) => {
            this.sourceLoaded(source, file);
          },
          onProgress(name),
          onError(name)
        );
      } else if (type === "hdrTexture") {
        if (paths.length === 0) {
          throw new Error(`No path provided for the ${name} source`);
        }
        this.loaders.hdrLoader.load(
          paths[0],
          (file) => {
            this.sourceLoaded(source, file);
          },
          onProgress(name),
          onError(name)
        );
      } else if (type === "gltfModel") {
        if (paths.length === 0) {
          throw new Error(`No path provided for the ${name} source`);
        }
        this.loaders.gltfLoader.load(
          paths[0],
          (file) => {
            this.sourceLoaded(source, file);
          },
          onProgress(name),
          onError(name)
        );
      }
    });
  }

  sourceLoaded(source: Source, file: Asset) {
    this.items[source.name] = file;
    this.loaded++;
    if (this.loaded === this.toLoad) {
      this.isReady = true;
      this.trigger("ready");
    }
    console.log(`${source.name} loaded`);
  }

  destroy() {
    this.off("ready");
    for (const key in this.items) {
      const item = this.items[key];
      if (item instanceof Texture) {
        item.dispose();
      } else if (item instanceof CubeTexture) {
        item.dispose();
      } else if (item instanceof DataTexture) {
        item.dispose();
      } else if ((item as GLTF).scene) {
        (item as GLTF).scene.traverse((child) => {
          if ((child as any).geometry) {
            (child as any).geometry.dispose();
          }
          if ((child as any).material) {
            const material = (child as any).material;
            if (Array.isArray(material)) {
              material.forEach((mat) => mat.dispose());
            } else {
              material.dispose();
            }
          }
        });
      }
    }
  }
}
