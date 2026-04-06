import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  build: {
    outDir: "build",
  },
  plugins: [svgr(), react()],
  server: {
    port: 5555,
  },
  define: {
    // "process.env": JSON.stringify(process.env),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // In the monorepo this package was referenced by its full workspace path.
      // Map it back to the local src directory when building standalone.
      "hkp-frontend/src": path.resolve(__dirname, "./src"),
    },
  },
});
