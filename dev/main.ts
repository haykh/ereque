import { Experience } from "ereque";

// import Example from "ereque/examples/Example1";
// new Experience(document.querySelector("canvas.webgl"), { World: Example });

// import Example from "ereque/examples/Example2";
// new Experience(document.querySelector("canvas.webgl"), { World: Example });

// import Example from "ereque/examples/Example3";
// new Experience(document.querySelector("canvas.webgl"), { World: Example });

// import Example from "ereque/examples/Example4";
// new Experience(document.querySelector("canvas.webgl"), { World: Example });

// import Example from "ereque/examples/Example5";
// new Experience(document.querySelector("canvas.webgl"), { World: Example });

// import Example from "ereque/examples/Example6";
// import { CustomRendererPipeline } from "ereque/examples/Example6";
// new Experience(document.querySelector("canvas.webgl"), {
//   World: Example,
//   pipeline: (o) => new CustomRendererPipeline(o),
// });

// import Example from "ereque/examples/Example7";
// import { CustomRendererPipeline } from "ereque/examples/Example7";
// new Experience(document.querySelector("canvas.webgl"), {
//   World: Example,
//   sources: [
//     {
//       name: "envMap",
//       type: "exrTexture",
//       paths: ["../static/hdr/christmas_photo_studio_01_4k.exr"],
//     },
//   ],
//   pipeline: (o) => new CustomRendererPipeline(o),
// });

import Example from "ereque/examples/Example8";
import { CustomRendererPipeline } from "ereque/examples/Example8";
new Experience(document.querySelector("canvas.webgl"), {
  World: Example,
  sources: [
    {
      name: "envMap",
      type: "hdrTexture",
      paths: ["../static/hdr/HDR_blue_nebulae_3.hdr"],
    },
  ],
  pipeline: (o) => new CustomRendererPipeline(o),
});
