import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The SPA talks to the FastAPI backend through VITE_API_URL. When the value is
// empty the bundle is served same-origin and nginx proxies /v1 to the backend.
export default defineConfig(() => {
  const target = process.env.VITE_API_URL || "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/v1": { target, changeOrigin: true },
        "/health": { target, changeOrigin: true },
      },
    },
    preview: { port: 5173 },
    build: { outDir: "dist", sourcemap: false },
  };
});