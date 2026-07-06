import type { Camera } from "three";
import { Uniform, Vector2 } from "three";
import { World } from "../World";
import type { WorldOptions } from "../World";
import { ParticleSimulation } from "../GPGPU/Simulation";
import type { SimulationOptions } from "../GPGPU/Simulation";

/*
 * Example with GPGPU particle solver implementing Boids algorithm
 */
import boidsDisplayVertexShader from "./shaders/gpgpu/boids/display.vert";
import boidsDisplayFragmentShader from "./shaders/gpgpu/boids/display.frag";
import boidsVelocityComputeShader from "./shaders/gpgpu/boids/velocity.glsl";
import boidsPushComputeShader from "./shaders/gpgpu/boids/push.glsl";

class Simulation extends ParticleSimulation {
  constructor(
    nparticles: number,
    opts: SimulationOptions & { sizes: { width: number; height: number } }
  ) {
    super(
      nparticles,
      {
        displayVertexShader: boidsDisplayVertexShader,
        displayFragmentShader: boidsDisplayFragmentShader,
      },
      opts
    );

    const parameters = {
      timestep: 1,
      separationRange: 0.2,
      visibleRange: 1,
      separationFactor: 0.1,
      alignmentFactor: 0.02,
      cohesionFactor: 0.002,
      uTurnFactor: 0.1,
      speedMinMax: new Vector2(0.2, 0.4),
    };

    this.debugFolder?.add(parameters, "timestep", 0.01, 5.0).onChange((v) => {
      this.gpgpu.updateComputeUniforms("uTimestep", v);
    });
    this.debugFolder
      ?.add(parameters, "separationRange", 0.0, 10.0, 0.0001)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uSeparationRange", v);
      });
    this.debugFolder
      ?.add(parameters, "visibleRange", 0.0, 10.0, 0.0001)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uVisibleRange", v);
      });
    this.debugFolder
      ?.add(parameters, "separationFactor", 0.0, 0.2, 0.0001)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uSeparationFactor", v);
      });
    this.debugFolder
      ?.add(parameters, "alignmentFactor", 0.0, 0.1, 0.0001)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uAlignmentFactor", v);
      });
    this.debugFolder
      ?.add(parameters, "cohesionFactor", 0.0, 0.1, 0.0001)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uCohesionFactor", v);
      });
    this.debugFolder
      ?.add(parameters, "uTurnFactor", 0.0, 0.2, 0.0001)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uTurnFactor", v);
      });
    this.debugFolder
      ?.add(parameters.speedMinMax, "x", 0.0, 2.0, 0.001)
      .name("speedMin");
    this.debugFolder
      ?.add(parameters.speedMinMax, "y", 0.0, 2.0, 0.001)
      .name("speedMax");

    this.gpgpu.addVariable("Positions");
    this.gpgpu.addVariable("Velocities");
    this.gpgpu.addComputeShader(
      "velocity_update",
      boidsVelocityComputeShader,
      "Velocities",
      ["Velocities", "Positions"],
      {
        uNparticles: new Uniform(nparticles),
        uTimestep: new Uniform(parameters.timestep),
        uSeparationRange: new Uniform(parameters.separationRange),
        uSeparationFactor: new Uniform(parameters.separationFactor),
        uVisibleRange: new Uniform(parameters.visibleRange),
        uAlignmentFactor: new Uniform(parameters.alignmentFactor),
        uCohesionFactor: new Uniform(parameters.cohesionFactor),
        uTurnFactor: new Uniform(parameters.uTurnFactor),
        uSpeedMinMax: new Uniform(parameters.speedMinMax),
      }
    );
    this.gpgpu.addComputeShader(
      "position_update",
      boidsPushComputeShader,
      "Positions",
      ["Positions", "Velocities"],
      {
        uTimestep: new Uniform(parameters.timestep),
      }
    );

    this.particleRenderer.addDisplayVariable("Positions");
    this.particleRenderer.addDisplayVariable("Velocities");

    const initPositions = this.gpgpu.createTexture();
    const initVelocities = this.gpgpu.createTexture();

    for (
      let i = 0;
      i < this.gpgpuTextureSize.x * this.gpgpuTextureSize.y;
      i++
    ) {
      initPositions.image.data![i * 4 + 0] = 5 * (Math.random() - 0.5);
      initPositions.image.data![i * 4 + 1] = 5 * (Math.random() - 0.5);
      initPositions.image.data![i * 4 + 2] = 5 * (Math.random() - 0.5);
      initPositions.image.data![i * 4 + 3] = 0;

      initVelocities.image.data![i * 4 + 0] = 1 * (Math.random() - 0.5);
      initVelocities.image.data![i * 4 + 1] = 1 * (Math.random() - 0.5);
      initVelocities.image.data![i * 4 + 2] = 1 * (Math.random() - 0.5);
      initVelocities.image.data![i * 4 + 3] = 0;
    }
    this.init({ Positions: initPositions, Velocities: initVelocities });
  }

  update(_: Camera, time: { elapsedSec: number }) {
    this.gpgpu.compute("velocity_update");
    this.gpgpu.compute("position_update");
    this.particleRenderer.render(time);
  }

  destroy() {
    super.destroy();
  }
}

export default class Example extends World {
  public simulation: Simulation;

  constructor(opts: WorldOptions) {
    super(opts);
    this.simulation = new Simulation(1000, {
      time: this.time,
      sizes: this.sizes,
      renderer: this.renderer,
      scene: this.scene,
      debug: this.debug,
    });
  }

  initialize() {}

  update() {
    super.update();
    this.simulation.update(this.camera, this.time);
  }

  destroy() {
    this.simulation.destroy();
  }
}
