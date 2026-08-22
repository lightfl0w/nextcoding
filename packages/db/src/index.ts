import "dotenv/config";
import { drizzle as createDb } from "drizzle-orm/libsql";

export const db = createDb(process.env.DB_URL ?? "");

export * from "./schema/achievements.js";
export * from "./schema/activities.js";
export * from "./schema/auth.js";
export * from "./schema/bookmarks.js";
export * from "./schema/messages.js";
export * from "./schema/novels.js";
export * from "./schema/reports.js";
export * from "./schema/settings.js";
export * from "./schema/social.js";
export * from "./schema/tags.js";
export * from "./schema/templates.js";
export * from "./schema/works.js";
