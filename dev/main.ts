import { Experience } from "ereque";

// A bundled example scene, imported from the library exactly as a consumer would.
import Example from "ereque/examples/Example6";
import { CustomRendererPipeline } from "ereque/examples/Example6";

new Experience(document.querySelector("canvas.webgl"), {
  World: Example,
  pipeline: (o) => new CustomRendererPipeline(o),
});
