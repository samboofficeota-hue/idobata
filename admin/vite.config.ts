import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
    host: "0.0.0.0",
    allowedHosts:
      process.env.VITE_ADMIN_FRONTEND_ALLOWED_HOSTS?.split(",") || [],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
