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
    port: 3000,
  },
  define: {
    // "process.env": JSON.stringify(process.env),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
