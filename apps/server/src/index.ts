import { serve } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { storageRoutes } from "./storage/routes.js";
import { userRoutes } from "./users/routes.js";
import { workRoutes } from "./works/index.js";
import { notificationRoutes } from "./works/routes/notificationRoutes.js";

const PORT = Number(process.env.PORT) || 3000;

const CORS_ORIGINS = (
    process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const app = new Hono();

app.use(
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
app.route("/api/users", userRoutes);
app.route("/api/works", workRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/storage", storageRoutes);

app.notFound((c) => c.json({ error: "接口不存在" }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "服务器内部错误" }, 500);
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
