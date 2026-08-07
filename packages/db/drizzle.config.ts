import type { Config } from "drizzle-kit";

export default {
    schema: "./src/auth-schema.ts",
    out: "./src/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.DB_URL!,
    },
} satisfies Config;
