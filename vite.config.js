import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@shared-styles": path.resolve(__dirname, "../../../styles"),
        },
    },
    server: {
        fs: {
            allow: ["../../../styles", ".."],
        },
        proxy: {
            "/api": {
                // target: "http://localhost:4567",
                target: "http://192.168.4.1:4567",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
