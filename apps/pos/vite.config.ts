import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core":       resolve(__dirname, "src/core"),
      "@modules":    resolve(__dirname, "src/modules"),
      "@components": resolve(__dirname, "src/components"),
      "@layout":     resolve(__dirname, "src/layout"),
      "@state":      resolve(__dirname, "src/state"),
      "@styles":     resolve(__dirname, "src/styles"),
      "@modules-ui": resolve(__dirname, "src/modules-ui"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
