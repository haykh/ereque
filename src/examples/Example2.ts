import type { Camera } from "three";
import { Uniform } from "three";
import { World } from "../World";
import type { WorldOptions } from "../World";
import { GridSimulation } from "../GPGPU/Simulation";
import type { SimulationOptions } from "../GPGPU/Simulation";
import MouseTracker from "../Utils/MouseTracker";

/*
 * Example heat diffusion with GPGPU grid solver
 */
import heatDisplayVertexShader from "./shaders/gpgpu/heat/display.vert";
import heatDisplayFragmentShader from "./shaders/gpgpu/heat/display.frag";
import heatComputeShader from "./shaders/gpgpu/heat/heat.glsl";
import heatBoundaryComputeShader from "./shaders/gpgpu/heat/boundary.glsl";

class Simulation extends GridSimulation {
  public mouseTracker: MouseTracker;
  public timestepsPerFrame: number = 1;

  constructor(
    gpgpuTextureSize: { x: number; y: number },
    opts: SimulationOptions & { sizes: { width: number; height: number } },
  ) {
    super(
      gpgpuTextureSize,
      {
        displayVertexShader: heatDisplayVertexShader,
        displayFragmentShader: heatDisplayFragmentShader,
      },
      opts,
    );
    this.mouseTracker = new MouseTracker({ sizes: opts.sizes });

    const parameters = {
      timestep: 0.1,
      conductivity: 1.0,
      sourceStrength: 1.0,
    };

    this.gpgpu.addVariable("Heat");

    this.gpgpu.addComputeShader(
      "heat_transfer",
      heatComputeShader,
      "Heat",
      ["Heat"],
      {
        uTimestep: new Uniform(parameters.timestep),
        uConductivity: new Uniform(parameters.conductivity),
        uPointerUv: new Uniform(this.mouseTracker.canvasCursor),
        uPrevPointerUv: new Uniform(this.mouseTracker.prevCanvasCursor),
        uPointerClicked: new Uniform(
          this.mouseTracker.clicked && this.mouseTracker.shiftDown,
        ),
        uSourceStrength: new Uniform(parameters.sourceStrength),
      },
    );
    this.gpgpu.addComputeShader(
      "boundary_conditions",
      heatBoundaryComputeShader,
      "Heat",
      ["Heat"],
    );

    const initTexture = this.gpgpu.createTexture();

    for (
      let i = 0;
      i < this.gpgpuTextureSize.x * this.gpgpuTextureSize.y;
      i++
    ) {
      for (let j = 0; j < 4; j++) {
        initTexture.image.data![i * 4 + j] = j < 3 ? 0 : Math.random();
      }
    }
    this.gridRenderer2D.addDisplayVariable("Heat");

    this.debugFolder?.add(parameters, "timestep", 0.01, 1.0).onChange((v) => {
      this.gpgpu.updateComputeUniforms("uTimestep", v);
    });
    this.debugFolder
      ?.add(parameters, "conductivity", 0.0, 1.0)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uConductivity", v);
      });
    this.debugFolder
      ?.add(parameters, "sourceStrength", 0.0, 5.0)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uSourceStrength", v);
      });
    this.debugFolder
      ?.add(this, "timestepsPerFrame" as any, 1, 50, 1)
      .name("steps per frame");

    this.init({ Heat: initTexture });
  }

  update(camera: Camera, time: { elapsedSec: number }) {
    this.mouseTracker.update(camera);

    const intersections = this.mouseTracker.raycaster.intersectObject(
      this.gridRenderer2D.mesh,
    );
    if (intersections.length > 0) {
      const uv = intersections[0].uv!;
      this.mouseTracker.prevCanvasCursor.copy(this.mouseTracker.canvasCursor);
      this.mouseTracker.canvasCursor.set(uv.x, uv.y);
    }
    this.gpgpu.shaders[
      "heat_transfer"
    ].material.uniforms.uPointerClicked.value =
      this.mouseTracker.clicked && this.mouseTracker.shiftDown;

    for (let i = 0; i < this.timestepsPerFrame; i++) {
      this.gpgpu.compute("heat_transfer");
      this.gpgpu.compute("boundary_conditions");
    }
    this.gridRenderer2D.render(time);
  }

  destroy() {
    this.mouseTracker.destroy();
    super.destroy();
  }
}

export default class Example extends World {
  public simulation: Simulation;

  constructor(opts: WorldOptions) {
    super(opts);
    this.simulation = new Simulation(
      { x: 1024, y: 1024 },
      {
        time: this.time,
        sizes: this.sizes,
        renderer: this.renderer,
        scene: this.scene,
        debug: this.debug,
      },
    );
  }

  public override update() {
    this.simulation.update(this.camera.instance, this.time);
  }

  destroy() {
    super.destroy();
    this.simulation.destroy();
  }
}
