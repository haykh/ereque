import type { Camera } from "three";
import { Uniform, Vector3 } from "three";
import { World } from "../World";
import type { WorldOptions } from "../World";
import { ParticleSimulation } from "../GPGPU/Simulation";
import type { SimulationOptions } from "../GPGPU/Simulation";

/*
 * Example with GPGPU particle solver implementing nbody algorithm
 */
import nbodyDisplayVertexShader from "./shaders/gpgpu/nbody/display.vert";
import nbodyDisplayFragmentShader from "./shaders/gpgpu/nbody/display.frag";
import nbodyVelocityComputeShader from "./shaders/gpgpu/nbody/velocity.glsl";
import nbodyPushComputeShader from "./shaders/gpgpu/nbody/push.glsl";

class Simulation extends ParticleSimulation {
  constructor(
    nparticles: number,
    opts: SimulationOptions & { sizes: { width: number; height: number } },
  ) {
    super(
      nparticles,
      {
        displayVertexShader: nbodyDisplayVertexShader,
        displayFragmentShader: nbodyDisplayFragmentShader,
      },
      opts,
    );

    const parameters = {
      timestep: 0.01,
    };

    this.debugFolder?.add(parameters, "timestep", 0.0, 1.0).onChange((v) => {
      this.gpgpu.updateComputeUniforms("uTimestep", v);
    });

    this.gpgpu.addVariable("PositionsMasses");
    this.gpgpu.addVariable("Velocities");
    this.gpgpu.addComputeShader(
      "velocity_update",
      nbodyVelocityComputeShader,
      "Velocities",
      ["Velocities", "PositionsMasses"],
      {
        uNparticles: new Uniform(nparticles),
        uTimestep: new Uniform(parameters.timestep),
      },
    );
    this.gpgpu.addComputeShader(
      "position_update",
      nbodyPushComputeShader,
      "PositionsMasses",
      ["PositionsMasses", "Velocities"],
      {
        uTimestep: new Uniform(parameters.timestep),
      },
    );

    this.particleRenderer.addDisplayVariable("PositionsMasses");
    this.particleRenderer.addDisplayVariable("Velocities");

    const initPositionsMasses = this.gpgpu.createTexture();
    const initVelocities = this.gpgpu.createTexture();

    const setPosition = (index: number, position: Vector3) => {
      initPositionsMasses.image.data![index * 4 + 0] = position.x;
      initPositionsMasses.image.data![index * 4 + 1] = position.y;
      initPositionsMasses.image.data![index * 4 + 2] = position.z;
    };

    const setMass = (index: number, mass: number) => {
      initPositionsMasses.image.data![index * 4 + 3] = mass;
    };

    const setVelocity = (index: number, velocity: Vector3) => {
      initVelocities.image.data![index * 4 + 0] = velocity.x;
      initVelocities.image.data![index * 4 + 1] = velocity.y;
      initVelocities.image.data![index * 4 + 2] = velocity.z;
      initVelocities.image.data![index * 4 + 3] = 0;
    };

    const totalMomentum = new Vector3(0, 0, 0);
    let totalMass = 0.0;
    for (let i = 0; i < nparticles; i++) {
      const randomPos = new Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      );
      const randomMass = Math.random() * 5 + 1.0;
      setPosition(i, randomPos);
      setMass(i, randomMass);

      const randomVel = new Vector3(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
      );
      setVelocity(i, randomVel);
      totalMass += randomMass;
      totalMomentum.addScaledVector(randomVel, randomMass);
    }
    for (let i = 0; i < nparticles; i++) {
      const vx = initVelocities.image.data![i * 4 + 0];
      const vy = initVelocities.image.data![i * 4 + 1];
      const vz = initVelocities.image.data![i * 4 + 2];
      initVelocities.image.data![i * 4 + 0] =
        vx - totalMomentum.x / nparticles / totalMass;
      initVelocities.image.data![i * 4 + 1] =
        vy - totalMomentum.y / nparticles / totalMass;
      initVelocities.image.data![i * 4 + 2] =
        vz - totalMomentum.z / nparticles / totalMass;
    }
    for (let i = 0; i < nparticles; i++) {
      const vx = initVelocities.image.data![i * 4 + 0];
      const vy = initVelocities.image.data![i * 4 + 1];
      const vz = initVelocities.image.data![i * 4 + 2];
      const px = initPositionsMasses.image.data![i * 4 + 0];
      const py = initPositionsMasses.image.data![i * 4 + 1];
      const pz = initPositionsMasses.image.data![i * 4 + 2];
      const posVec = new Vector3(px, py, pz).normalize();
      const velVec = new Vector3(vx, vy, vz);
      const dot = velVec.dot(posVec);
      const projected = posVec.multiplyScalar(dot);
      const perp = velVec.sub(projected);
      initVelocities.image.data![i * 4 + 0] = perp.x;
      initVelocities.image.data![i * 4 + 1] = perp.y;
      initVelocities.image.data![i * 4 + 2] = perp.z;
    }

    // setPosition(0, new Vector3(-1, 0, 0));
    // setVelocity(0, new Vector3(0, 0, 0));
    // setMass(0, 100);

    // setPosition(1, new Vector3(1, 0, 0));
    // setVelocity(1, new Vector3(0, 0, -0.4));
    // setMass(1, 1);

    const computeTotalEnergy = () => {
      let totalKineticEnergy = 0;
      let totalPotentialEnergy = 0;
      for (let i = 0; i < nparticles; i++) {
        const vx = initVelocities.image.data![i * 4 + 0];
        const vy = initVelocities.image.data![i * 4 + 1];
        const vz = initVelocities.image.data![i * 4 + 2];
        const speedSquared = vx * vx + vy * vy + vz * vz;
        const mass = initPositionsMasses.image.data![i * 4 + 3];
        totalKineticEnergy += 0.5 * mass * speedSquared;

        const xi = initPositionsMasses.image.data![i * 4 + 0];
        const yi = initPositionsMasses.image.data![i * 4 + 1];
        const zi = initPositionsMasses.image.data![i * 4 + 2];

        for (let j = i + 1; j < nparticles; j++) {
          const xj = initPositionsMasses.image.data![j * 4 + 0];
          const yj = initPositionsMasses.image.data![j * 4 + 1];
          const zj = initPositionsMasses.image.data![j * 4 + 2];
          const mj = initPositionsMasses.image.data![j * 4 + 3];

          const dx = xi - xj;
          const dy = yi - yj;
          const dz = zi - zj;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-10;
          totalPotentialEnergy -= (mass * mj) / distance;
        }
      }
      const totalEnergy = totalKineticEnergy + totalPotentialEnergy;
      console.log(
        `Total Energy: Kinetic = ${totalKineticEnergy.toFixed(
          4,
        )}, Potential = ${totalPotentialEnergy.toFixed(
          4,
        )}, Total = ${totalEnergy.toFixed(4)}`,
      );
    };
    computeTotalEnergy();

    this.init({
      PositionsMasses: initPositionsMasses,
      Velocities: initVelocities,
    });
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
    this.simulation = new Simulation(2000, {
      time: this.time,
      sizes: this.sizes,
      renderer: this.renderer.instance,
      scene: this.scene,
      debug: this.debug,
    });
  }

  public override update() {
    this.simulation.update(this.camera.instance, this.time);
  }

  destroy() {
    super.destroy();
    this.simulation.destroy();
  }
}
