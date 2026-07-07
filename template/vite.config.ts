import type { UserConfig } from "vite";

export default {
  root: "src/",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
  },
} satisfies UserConfig;
