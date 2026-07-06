# ereque

A tiny, extensible [Three.js](https://threejs.org/) engine. It owns the boring
parts — canvas, render loop, camera + orbit controls, resizing, asset loading,
a debug GUI, and a GPGPU compute layer — and lets you drop in your own scene by
subclassing `World`. A handful of example scenes ship with it under
`ereque/examples/*` (like `three/examples/jsm`).

```
ereque/
  package.json          the library
  tsconfig.json         type-check config
  tsconfig.build.json   declaration emit (dist/)
  vite.config.ts        library build (build) + dev playground (serve)
  index.html            dev playground entry
  dev/                  dev-only playground (not published)
    main.ts  style.css
  src/                  library source (published as dist/)
    index.ts            public API
    Experience.ts  World.ts  Camera.ts  Renderer.ts  ...
    GPGPU/  Utils/
    examples/           Example1..4 + shaders  ->  ereque/examples/*
```

## Develop

```sh
npm install
npm run dev      # Vite playground; dev/main.ts imports "ereque" (aliased to src/)
```

Other scripts:

```sh
npm run build       # dist/ = ESM (Vite, shaders inlined) + .d.ts (tsc)
npm run typecheck
npm run lint
```

## Use it

`three` is a peer dependency — install the version you want. The package is ESM
and meant to be consumed through a bundler (Vite, webpack, Rollup, …).

```ts
import { Experience, World } from "ereque";
import type { WorldOptions } from "ereque";

class MyWorld extends World {
  constructor(opts: WorldOptions) {
    super(opts);
  }

  // Runs once resources are ready (immediately when there are none).
  initialize() {
    // build meshes and add them to this.scene; read this.camera / this.renderer
  }

  update() {
    super.update();
    // per-frame logic using this.time
  }

  destroy() {
    super.destroy();
    // release anything you created
  }
}

new Experience(document.querySelector("canvas.webgl"), { World: MyWorld });
```

…or run a bundled example directly:

```ts
import { Experience } from "ereque";
import Example3 from "ereque/examples/Example3"; // boids
// or: import { Example3 } from "ereque/examples";

new Experience(document.querySelector("canvas.webgl"), { World: Example3 });
```

- `Example1` — custom shader material on a sphere
- `Example2` — GPGPU heat-diffusion grid
- `Example3` — GPGPU boids (flocking) particles
- `Example4` — GPGPU n-body gravity particles

Preload assets with `sources`; they resolve on `this.resources.items` before
`initialize()` runs:

```ts
import type { SourceList } from "ereque";

const sources: SourceList = [
  { name: "envMap", type: "hdrTexture", paths: ["/env.hdr"] },
];

new Experience(canvas, { World: MyWorld, sources });
```

Append `#debug` to the URL to enable the lil-gui debug panel.

## Install without publishing

Build first (`npm run build`), then in another project:

```sh
# a) tarball — behaves exactly like a real npm install
npm pack                                   # -> ereque-0.1.0.tgz
#   then, in your app:
npm install /abs/path/to/ereque-0.1.0.tgz three

# b) local path (symlink; good for iterating — re-run `npm run build` after edits)
npm install /abs/path/to/ereque three
#   add resolve.dedupe: ["three"] to your app's vite config to avoid duplicate three
```

To publish for real later: `npm publish`.

## Exports

- `Experience` — orchestrator; owns the loop and wires everything together.
- `World` — base class you extend (the extension point).
- `Camera`, `Renderer`, `Resources` — the pieces `Experience` composes.
- `GridSimulation`, `ParticleSimulation`, `GPUComputationRenderer`,
  `GPGPUGridRenderer2D`, `GPGPUParticleRenderer` — GPGPU compute helpers.
- `CustomShaderMaterial`, `MouseTracker`, `Sizes`, `Time`, `Debug`,
  `EventEmitter`, `DisposeScene`, `glsl` — utilities.

> Note: `Resources` loads Draco-compressed glTF using the decoder at `/draco/`.
> Copy the Draco decoder there if you use that feature.
