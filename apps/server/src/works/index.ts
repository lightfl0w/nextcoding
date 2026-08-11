import { Hono } from "hono";
import { catalogRoutes } from "./routes/catalogRoutes.js";
import { commentRoutes } from "./routes/commentRoutes.js";
import { fileRoutes } from "./routes/fileRoutes.js";
import { remixRoutes } from "./routes/remixRoutes.js";
import { sparkRoutes } from "./routes/sparkRoutes.js";
import { versionRoutes } from "./routes/versionRoutes.js";

export const workRoutes = new Hono()
    .route("/", commentRoutes)
    .route("/", fileRoutes)
    .route("/", versionRoutes)
    .route("/", catalogRoutes)
    .route("/", sparkRoutes)
    .route("/", remixRoutes);
