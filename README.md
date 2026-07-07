# ereque (երեք)

A tiny, extensible [Three.js](https://threejs.org/) wrapper with a convenient GPGPU support.

## Develop

```sh
npm i
npm run dev      # Vite playground; dev/main.ts imports "ereque" (aliased to src/)
```

Build and pack:

```sh
npm run build       # dist/ = ESM (Vite, shaders inlined) + .d.ts (tsc)
npm run typecheck
npm run lint
npm pack            # produces .tgz file
```

## Usage

You can simply copy the embedded `template/` project, change the path to the ereque `.tgz` file and simply `npm i` and start playing with `npm run dev`. 

Otherwise, simply install in your project with:

```sh
npm i /abs/path/to/ereque-<VERSION>.tgz three
```

`three` is a peer dependency -- install the version you want. The package is ESM and meant to be consumed through a bundler (Vite, webpack, Rollup, ...).

```ts
import { Experience, World } from "ereque";
import type { WorldOptions } from "ereque";

class MyWorld extends World {
  constructor(opts: WorldOptions) {
    super(opts);
  }

  // Runs once resources are ready (immediately when there are none).
  protected override initialize() {
    // build meshes and add them to this.scene; read this.camera / this.renderer
  }

  public override update() {
    // per-frame logic using this.time
  }

  destroy() {
    super.destroy();
    // release anything you created
  }
}

new Experience(document.querySelector("canvas.webgl"), { World: MyWorld });
```

...or run a bundled example directly:

```ts
import { Experience } from "ereque";
import Example3 from "ereque/examples/Example3"; // boids
// or: import { Example3 } from "ereque/examples";

new Experience(document.querySelector("canvas.webgl"), { World: Example3 });
```

- `Example1`: custom shader material on a sphere
- `Example2`: GPGPU heat-diffusion grid
- `Example3`: GPGPU boids (flocking) particles
- `Example4`: GPGPU n-body gravity particles
- `Example5`: GPGPU FDTD maxwell solver

Preload assets with `sources`; they resolve on `this.resources.items` before `initialize()` runs:

```ts
import type { SourceList } from "ereque";

const sources: SourceList = [
  { name: "envMap", type: "hdrTexture", paths: ["/env.hdr"] },
];

new Experience(canvas, { World: MyWorld, sources });
```

Append `#debug` to the URL to enable the lil-gui debug panel.

## Exports

- `Experience`: orchestrator; owns the loop and wires everything together.
- `World`: base class you extend (the extension point).
- `Camera`, `Renderer`, `Resources`: the pieces `Experience` composes.
- `GridSimulation`, `ParticleSimulation`, `GPUComputationRenderer`, `GPGPUGridRenderer2D`, `GPGPUParticleRenderer`: GPGPU compute helpers.
- `CustomShaderMaterial`, `MouseTracker`, `Sizes`, `Time`, `Debug`, `EventEmitter`, `DisposeScene`, `glsl`: utilities.

> Note: `Resources` loads Draco-compressed glTF using the decoder at `/draco/`.
> Copy the Draco decoder there if you use that feature.
