var _a;
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
        allowedHosts: ((_a = process.env.VITE_ADMIN_FRONTEND_ALLOWED_HOSTS) === null || _a === void 0 ? void 0 : _a.split(",")) || [],
    },
});
