import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@test": path.resolve(import.meta.dirname, "test"),
        },
    },
    test: {
        environment: "node",
        include: ["test/**/*.test.ts"],
        unstubEnvs: true,
        unstubGlobals: true,
    },
});
