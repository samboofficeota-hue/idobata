var _a;
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173, // idea-discussion/backendのCORS設定に合わせたポート
        host: "0.0.0.0",
        allowedHosts: ((_a = process.env.VITE_FRONTEND_ALLOWED_HOSTS) === null || _a === void 0 ? void 0 : _a.split(",")) || [],
    },
    build: {
        outDir: "dist",
        assetsDir: "assets",
    },
    esbuild: {
        keepNames: true,
        minifyIdentifiers: false,
    },
});
