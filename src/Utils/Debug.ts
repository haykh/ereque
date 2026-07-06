import {
  CanvasTexture,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  Mesh,
  MeshBasicMaterial,
  Texture,
  Vector2,
  Vector4,
  WebGLRenderer,
} from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

export default class Debug {
  public readonly active: boolean;
  public readonly ui: GUI | null;

  constructor() {
    this.active = window.location.hash === "#debug";
    this.ui = null;

    if (this.active) {
      this.ui = new GUI();
    }
  }

  getUI(): GUI {
    return this.ui as GUI;
  }

  destroy() {
    this.ui?.destroy();
  }
}

export class DebugCanvas {
  public instance: HTMLCanvasElement;
  public context: CanvasRenderingContext2D;
  public texture: CanvasTexture;

  constructor(
    textureSize: { width: number; height: number } = {
      width: 128,
      height: 128,
    },
    displaySize: { width: number; height: number } = {
      width: 380,
      height: 380,
    },
  ) {
    this.instance = document.createElement("canvas");
    this.instance.width = textureSize.width;
    this.instance.height = textureSize.height;
    this.instance.style.width = `${displaySize.width}px`;
    this.instance.style.height = `${displaySize.height}px`;
    this.instance.style.position = "fixed";
    this.instance.style.top = "0";
    this.instance.style.left = "0";
    this.instance.style.zIndex = "10";
    document.body.append(this.instance);

    this.context = this.instance.getContext("2d")!;
    this.texture = new CanvasTexture(this.instance);

    this.context.fillRect(0, 0, this.instance.width, this.instance.height);
  }

  update() {
    this.texture.needsUpdate = true;
  }
}

export class DebugQuad {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private mesh: Mesh;
  private texture: Texture | null = null;

  private heightFraction: number;

  constructor(renderer: WebGLRenderer, heightFraction: number = 0.3) {
    this.renderer = renderer;
    this.heightFraction = heightFraction;

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geom = new PlaneGeometry(2, 2);
    const mat = new MeshBasicMaterial();

    this.mesh = new Mesh(geom, mat);
    this.scene.add(this.mesh);
  }

  setTexture(tex: Texture) {
    this.texture = tex;
    (this.mesh.material as MeshBasicMaterial).map = tex;
    (this.mesh.material as MeshBasicMaterial).needsUpdate = true;
  }

  render() {
    if (this.texture === null) return;
    const size = new Vector2();
    this.renderer.getSize(size);
    const viewportHeight = size.y;

    const h = viewportHeight * this.heightFraction;

    const texAny = this.texture as any;
    const texWidth = texAny.width ?? 1;
    const texHeight = texAny.height ?? 1;
    const texAspect = texWidth / texHeight;

    const w = h * texAspect;

    const x = 0;
    const y = viewportHeight - h;

    const prevViewport = this.renderer.getViewport(new Vector4());
    const prevScissor = this.renderer.getScissor(new Vector4());
    const prevScissorTest = this.renderer.getScissorTest();
    const prevAutoClear = this.renderer.autoClear;

    this.renderer.setViewport(x, y, w, h);
    this.renderer.setScissor(x, y, w, h);
    this.renderer.setScissorTest(true);

    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);

    this.renderer.setViewport(
      prevViewport.x,
      prevViewport.y,
      prevViewport.z,
      prevViewport.w,
    );
    this.renderer.setScissor(
      prevScissor.x,
      prevScissor.y,
      prevScissor.z,
      prevScissor.w,
    );
    this.renderer.setScissorTest(prevScissorTest);
    this.renderer.autoClear = prevAutoClear;
  }
}
