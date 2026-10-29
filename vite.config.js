import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "src"),
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
