import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

const srcDir = fileURLToPath(new URL("src", import.meta.url));

export default defineConfig(({ command }) => {
  if (command === "build") {
    // Library build -> dist (ESM). `three` (and its subpaths) stay external;
    // GLSL imports in the example scenes are inlined so the published package is
    // self-contained. Type declarations are emitted separately by `tsc`
    // (see tsconfig.build.json).
    return {
      plugins: [glsl()],
      build: {
        outDir: "dist",
        emptyOutDir: false,
        sourcemap: true,
        minify: false,
        lib: {
          entry: {
            index: "src/index.ts",
            "examples/index": "src/examples/index.ts",
          },
          formats: ["es"],
        },
        rollupOptions: {
          external: [/^three(\/.*)?$/],
          output: {
            preserveModules: true,
            preserveModulesRoot: "src",
            entryFileNames: "[name].js",
          },
        },
      },
    };
  }

  // Dev playground (`npm run dev`): resolve "ereque" and its subpaths to the
  // source so dev/main.ts imports the library exactly like an external consumer
  // would, with live HMR.
  return {
    plugins: [glsl()],
    resolve: {
      alias: [
        { find: /^ereque$/, replacement: `${srcDir}/index.ts` },
        { find: /^ereque\/(.*)$/, replacement: `${srcDir}/$1` },
      ],
    },
  };
});
