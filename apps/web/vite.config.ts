import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const CROSS_ORIGIN_ISOLATION_HEADERS: Record<string, string> = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
};

const config = defineConfig({
    resolve: {
        tsconfigPaths: true,
        dedupe: ["react", "react-dom"],
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
            },
        },
        headers: CROSS_ORIGIN_ISOLATION_HEADERS,
    },
    preview: {
        headers: CROSS_ORIGIN_ISOLATION_HEADERS,
    },
    plugins: [
        devtools(),
        tailwindcss(),
        tanstackRouter({ target: "react", autoCodeSplitting: true }),
        viteReact(),
    ],
});

export default config;
