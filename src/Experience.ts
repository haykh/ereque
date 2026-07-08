import { Scene } from "three";
import Stats from "three/addons/libs/stats.module.js";

import Sizes from "./Utils/Sizes";
import Time from "./Utils/Time";
import Resources from "./Utils/Resources";
import Debug from "./Utils/Debug";
import Camera from "./Camera";
import Renderer from "./Renderer";
import DisposeScene from "./Utils/Dispose";

import { World } from "./World";
import type { WorldOptions } from "./World";
import type { SourceList } from "./sources";
import DefaultRendererPipeline from "./Utils/RendererPipeline";
import type { RendererPipelineFactory } from "./Utils/RendererPipeline";

/** Constructor of a user-supplied {@link World} implementation. */
export interface WorldConstructor {
  new (opts: WorldOptions): World;
}

export interface ExperienceConfig {
  World?: WorldConstructor;
  pipeline?: RendererPipelineFactory;
  sources?: SourceList;
}

export default class Experience {
  private stats = new Stats();

  public canvas: HTMLCanvasElement;
  public debug: Debug;
  public sizes: Sizes;
  public time: Time;
  public scene: Scene;
  public resources: Resources;
  public camera: Camera;
  public renderer: Renderer;
  public world: World;

  constructor(canvas: HTMLCanvasElement | null, config: ExperienceConfig = {}) {
    if (canvas === null) {
      throw new Error("Experience received a null for canvas");
    }
    const WorldClass = config.World ?? World;
    const sources = config.sources ?? [];

    document.body.appendChild(this.stats.dom);
    this.canvas = canvas;

    // Expose the running instance for debugging (e.g. `window.experience` in
    // the console) without augmenting the consumer's global `Window` type.
    (window as unknown as { experience?: Experience }).experience = this;

    this.debug = new Debug();
    this.sizes = new Sizes();
    this.time = new Time();
    this.scene = new Scene();
    this.resources = new Resources(sources);
    this.camera = new Camera(this.opts());

    this.renderer = new Renderer({
      ...this.opts(),
      pipeline: config.pipeline ?? ((o) => new DefaultRendererPipeline(o)),
    });

    this.world = new WorldClass(this.opts());

    this.world.start();

    this.sizes.on("resize", () => {
      this.resize();
    });
    this.time.on("tick", () => {
      this.update();
    });
  }

  opts() {
    return {
      time: this.time,
      sizes: this.sizes,
      canvas: this.canvas,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      resources: this.resources,
      debug: this.debug,
    };
  }

  resize() {
    this.camera.resize();
    this.renderer.resize();
  }

  update() {
    this.camera.update();
    this.renderer.update(this.time);
    this.world.update?.();
    this.stats.update();
  }

  destroy() {
    this.world.destroy();

    this.resources.destroy();
    this.camera.destroy();
    this.renderer.destroy();

    this.debug.destroy();
    this.sizes.destroy();
    this.time.destroy();

    this.sizes.off("resize");
    this.time.off("tick");

    DisposeScene(this.scene);
    this.scene.clear();
  }
}
