import path from "node:path";

import { defineConfig } from "vitest/config";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:5173";

export default defineConfig({
    define: {
        "import.meta.env.BACKEND_URL": JSON.stringify(BACKEND_URL),
        "import.meta.env.BETTER_AUTH_URL": JSON.stringify(BETTER_AUTH_URL),
    },
    resolve: {
        alias: {
            "~": path.resolve(import.meta.dirname, "src"),
            "@": path.resolve(import.meta.dirname, "src"),
        },
    },
    test: {
        environment: "node",
        include: ["test/**/*.test.{ts,tsx}"],
        unstubEnvs: true,
        unstubGlobals: true,
    },
});
