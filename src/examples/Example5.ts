import type { Camera } from "three";
import { Uniform, Vector2 } from "three";
import { World } from "../World";
import type { WorldOptions } from "../World";
import { GridSimulation } from "../GPGPU/Simulation";
import type { SimulationOptions } from "../GPGPU/Simulation";
import MouseTracker from "../Utils/MouseTracker";

/*
 * Example maxwell solver with GPGPU grid solver
 */
import maxwellDisplayVertexShader from "./shaders/gpgpu/maxwell/display.vert";
import maxwellDisplayFragmentShader from "./shaders/gpgpu/maxwell/display.frag";
import maxwellFaradayComputeShader from "./shaders/gpgpu/maxwell/faraday.glsl";
import maxwellAmpereComputeShader from "./shaders/gpgpu/maxwell/ampere.glsl";
import maxwellBoundaryComputeShader from "./shaders/gpgpu/maxwell/boundary.glsl";

const Fields = ["Bx", "By", "Ez"];
const BoundaryConditions = ["periodic", "reflecting", "absorbing"];

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
        displayVertexShader: maxwellDisplayVertexShader,
        displayFragmentShader: maxwellDisplayFragmentShader,
      },
      opts,
      {
        vmin: -1,
        vmax: 1,
        map: "bipolar",
        reverse: false,
      },
    );

    // compute
    this.mouseTracker = new MouseTracker({ sizes: opts.sizes });

    const parameters = {
      timestep: 0.9,
      sourceStrength: 10000.0,
      reflectivity: -5,
      x_boundaries: BoundaryConditions[1],
      y_boundaries: BoundaryConditions[1],
      which_field: Fields[2],
    };

    const pml_sigmamax = (
      reflectivity: number,
      pml_order: number = 3,
      pml_ncells: number = 12,
    ) =>
      (-(pml_order + 1) *
        this.gpgpuTextureSize.x *
        Math.log(Math.pow(10, reflectivity))) /
      (2 * pml_ncells);

    const boundaries_to_vector = (x: string, y: string) =>
      new Vector2(BoundaryConditions.indexOf(x), BoundaryConditions.indexOf(y));

    this.gpgpu.addVariable("EM");

    this.gpgpu.addComputeShader(
      "faraday_update",
      maxwellFaradayComputeShader,
      "EM",
      ["EM"],
      {
        uTimestep: new Uniform(parameters.timestep),
        uPmlSigmaMax: new Uniform(pml_sigmamax(parameters.reflectivity)),
        uBoundaryConditions: new Uniform(
          boundaries_to_vector(
            parameters.x_boundaries,
            parameters.y_boundaries,
          ),
        ),
      },
    );
    this.gpgpu.addComputeShader(
      "ampere_update",
      maxwellAmpereComputeShader,
      "EM",
      ["EM"],
      {
        uTimestep: new Uniform(parameters.timestep),
        uPmlSigmaMax: new Uniform(pml_sigmamax(parameters.reflectivity)),
        uPointerUv: new Uniform(this.mouseTracker.canvasCursor),
        uPointerClicked: new Uniform(
          this.mouseTracker.clicked && this.mouseTracker.shiftDown,
        ),
        uSourceStrength: new Uniform(parameters.sourceStrength),
        uBoundaryConditions: new Uniform(
          boundaries_to_vector(
            parameters.x_boundaries,
            parameters.y_boundaries,
          ),
        ),
      },
    );
    this.gpgpu.addComputeShader(
      "boundary_conditions",
      maxwellBoundaryComputeShader,
      "EM",
      ["EM"],
      {
        uBoundaryConditions: new Uniform(
          boundaries_to_vector(
            parameters.x_boundaries,
            parameters.y_boundaries,
          ),
        ),
      },
    );

    this.debugFolder?.add(parameters, "timestep", 0.01, 1.0).onChange((v) => {
      this.gpgpu.updateComputeUniforms("uTimestep", v);
    });
    this.debugFolder
      ?.add(parameters, "x_boundaries", BoundaryConditions)
      .name("x boundaries")
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms(
          "uBoundaryConditions",
          new Vector2(
            BoundaryConditions.indexOf(v),
            BoundaryConditions.indexOf(parameters.y_boundaries),
          ),
        );
      });
    this.debugFolder
      ?.add(parameters, "y_boundaries", BoundaryConditions)
      .name("y boundaries")
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms(
          "uBoundaryConditions",
          new Vector2(
            BoundaryConditions.indexOf(parameters.x_boundaries),
            BoundaryConditions.indexOf(v),
          ),
        );
      });
    this.debugFolder
      ?.add(parameters, "reflectivity", -10, 0)
      .name("log10 reflectivity")
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uPmlSigmaMax", pml_sigmamax(v));
      });
    this.debugFolder
      ?.add(parameters, "sourceStrength", 0.0, 50000.0)
      .onChange((v) => {
        this.gpgpu.updateComputeUniforms("uSourceStrength", v);
      });
    this.debugFolder
      ?.add(this, "timestepsPerFrame" as any, 1, 50, 1)
      .name("steps per frame");

    // rendering
    this.gridRenderer2D.addDisplayVariable("EM");
    this.gridRenderer2D.displayShaderMaterial.uniforms["uWhichField"] =
      new Uniform(Fields.indexOf(parameters.which_field));
    this.gridRenderer2D.debugFolder
      ?.add(parameters, "which_field", Fields)
      .name("field to display")
      .onChange((v) => {
        this.gridRenderer2D.displayShaderMaterial.uniforms.uWhichField.value =
          Fields.indexOf(v);
      });

    // initialization
    const initTexture = this.gpgpu.createTexture();
    this.init({ EM: initTexture });
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
      "ampere_update"
    ].material.uniforms.uPointerClicked.value =
      this.mouseTracker.clicked && this.mouseTracker.shiftDown;

    for (let i = 0; i < this.timestepsPerFrame; i++) {
      this.gpgpu.compute("faraday_update");
      this.gpgpu.compute("ampere_update");
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
    this.camera.instance.position.set(0, 0, 5);
    this.camera.controls.enabled = false;
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
