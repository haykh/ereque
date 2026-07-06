import { Experience } from "ereque";

// A bundled example scene, imported from the library exactly as a consumer would.
import Example3 from "ereque/examples/Example3";

new Experience(document.querySelector("canvas.webgl"), { World: Example3 });
