import type { Config } from "drizzle-kit";

export default {
    schema: [
        "./src/schema/auth.ts",
        "./src/schema/works.ts",
        "./src/schema/social.ts",
        "./src/schema/tags.ts",
        "./src/schema/bookmarks.ts",
        "./src/schema/templates.ts",
        "./src/schema/activities.ts",
        "./src/schema/messages.ts",
        "./src/schema/achievements.ts",
        "./src/schema/reports.ts",
        "./src/schema/settings.ts",
        "./src/schema/novels.ts",
    ],
    out: "./src/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.DB_URL ?? "",
    },
} satisfies Config;
