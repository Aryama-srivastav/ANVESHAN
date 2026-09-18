import { defineConfig } from "vite";

// The frontend talks to the FastAPI backend through VITE_API_URL. In development
// the /v1 and /health paths are also proxied so the app can be served same-origin.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: process.env.VITE_API_URL || "http://localhost:8000", changeOrigin: true },
      "/health": { target: process.env.VITE_API_URL || "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});