import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";

export const db = drizzle(process.env.DB_URL! || "");

export * from "./schema/auth.js";
export * from "./schema/works.js";
