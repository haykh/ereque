/**
 * Bundled example scenes.
 *
 * These ship with the package (shaders inlined) and can be imported directly:
 *
 * ```ts
 * import { Experience } from "ereque";
 * import { Example3 } from "ereque/examples";        // or:
 * import Example3 from "ereque/examples/Example3";
 *
 * new Experience(canvas, { World: Example3 });
 * ```
 *
 * - `Example1` — custom shader material on a sphere
 * - `Example2` — GPGPU heat-diffusion grid
 * - `Example3` — GPGPU boids (flocking) particles
 * - `Example4` — GPGPU n-body gravity particles
 */
export { default as Example1 } from "./Example1";
export { default as Example2 } from "./Example2";
export { default as Example3 } from "./Example3";
export { default as Example4 } from "./Example4";
