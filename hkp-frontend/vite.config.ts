import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// Serve the /boards directory as static JSON files in dev mode.
// In production the boards directory should be copied to the build output.
const serveBoardsPlugin = {
  name: "serve-boards",
  configureServer(server: any) {
    server.middlewares.use(
      "/boards",
      (req: any, res: any, next: () => void) => {
        const filePath = path.resolve(
          __dirname,
          "boards",
          req.url.replace(/^\//, ""),
        );
        if (
          filePath.startsWith(path.resolve(__dirname, "boards")) &&
          fs.existsSync(filePath) &&
          fs.statSync(filePath).isFile()
        ) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(fs.readFileSync(filePath, "utf-8"));
        } else {
          next();
        }
      },
    );
  },
};

export default defineConfig({
  build: {
    outDir: "build",
  },
  plugins: [svgr(), react(), serveBoardsPlugin],
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
