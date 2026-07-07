import { Experience } from "ereque";
import TemplateWorld from "./TemplateWorld";

// Hand your World to the engine; it owns the canvas, render loop, camera, etc.
new Experience(document.querySelector("canvas.webgl"), {
  World: TemplateWorld,
});

// Tip: to see a bundled example instead, swap the import for one of:
//   import World from "ereque/examples/Example3"; // boids
//   import World from "ereque/examples/Example4"; // n-body
// and pass it as { World }.
