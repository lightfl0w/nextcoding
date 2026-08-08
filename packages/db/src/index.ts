import "dotenv/config";
import { drizzle as createDb } from "drizzle-orm/libsql";

export const db = createDb(process.env.DB_URL! || "");

export * from "./schema/auth.js";
export * from "./schema/works.js";
