import { serve } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { userRoutes } from "./users/routes.js";
import { workRoutes } from "./works/index.js";
import { notificationRoutes } from "./works/routes/notificationRoutes.js";

const PORT = Number(process.env.PORT) || 3000;

const app = new Hono();

app.use(cors());
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api/users", userRoutes);
app.route("/api/works", workRoutes);
app.route("/api/notifications", notificationRoutes);

app.notFound((c) => c.json({ error: "接口不存在" }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "服务器内部错误" }, 500);
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
