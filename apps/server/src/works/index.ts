import { Hono } from "hono";
import { bookmarkRoutes } from "../bookmarks/routes.js";
import { gitRoutes } from "../git/routes.js";
import { reportRoutes } from "../reports/routes.js";
import { catalogRoutes } from "./routes/catalogRoutes.js";
import { commentRoutes } from "./routes/commentRoutes.js";
import { fileRoutes } from "./routes/fileRoutes.js";
import { leaderboardRoutes } from "./routes/leaderboardRoutes.js";
import { remixRoutes } from "./routes/remixRoutes.js";
import { repoRoutes } from "./routes/repoRoutes.js";
import { sparkRoutes } from "./routes/sparkRoutes.js";
import { versionRoutes } from "./routes/versionRoutes.js";

export const workRoutes = new Hono()
    .route("/", gitRoutes)
    .route("/", commentRoutes)
    .route("/", fileRoutes)
    .route("/", versionRoutes)
    .route("/", repoRoutes)
    .route("/", catalogRoutes)
    .route("/", sparkRoutes)
    .route("/", remixRoutes)
    .route("/", bookmarkRoutes)
    .route("/", reportRoutes)
    .route("/", leaderboardRoutes);
