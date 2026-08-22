import { serve } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { ensureAchievements } from "./achievements/repository.js";
import { achievementRoutes } from "./achievements/routes.js";
import { activityFeedRoutes, activityUserRoutes } from "./activities/routes.js";
import { adminRoutes } from "./admin/routes.js";
import { messageRoutes } from "./messages/routes.js";
import { openapiJson } from "./openapi/document.js";
import { registerWsRoutes, wss } from "./realtime/io.js";
import { settingsRoutes } from "./settings/routes.js";
import { storageRoutes } from "./storage/routes.js";
import { tagRoutes } from "./tags/routes.js";
import { templateRoutes } from "./templates/routes.js";
import { userRoutes } from "./users/routes.js";
import { workRoutes } from "./works/index.js";
import { notificationRoutes } from "./works/routes/notificationRoutes.js";
import { novelRoutes } from "./novels/routes.js";

const PORT = Number(process.env.PORT) || 3000;

const CORS_ORIGINS = (
    process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const app = new Hono();

registerWsRoutes(app);

app.use(
    "*",
    cors({
        origin: (origin) => {
            if (!origin || CORS_ORIGINS.includes(origin)) {
                return origin;
            }
            return null;
        },
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    }),
);
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api/achievements", achievementRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/users", userRoutes);
app.route("/api/users", activityUserRoutes);
app.route("/api", activityFeedRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/templates", templateRoutes);
app.route("/api/works", workRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/novels", novelRoutes);

app.get("/openapi.json", (c) => c.json(openapiJson));

app.notFound((c) => c.json({ error: "接口不存在" }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "服务器内部错误" }, 500);
});

await ensureAchievements();

serve(
    {
        fetch: app.fetch,
        port: PORT,
        websocket: { server: wss },
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
