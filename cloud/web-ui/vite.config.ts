import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core":       resolve(__dirname, "src/core"),
      "@components": resolve(__dirname, "src/components"),
      "@screens":    resolve(__dirname, "src/screens"),
      "@state":      resolve(__dirname, "src/state"),
      "@styles":     resolve(__dirname, "src/styles"),
    },
  },
  server: {
    host: true,
    port: 5174,
  },
  build: { outDir: "dist", sourcemap: true },
});
