import { serve } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getStorage } from "./storage/storageClient.js";
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

const STORAGE_ROUTE_PREFIX = "/api/storage";

app.get("/api/storage/*", async (c) => {
    const rest = c.req.path
        .slice(STORAGE_ROUTE_PREFIX.length)
        .replace(/^\/+/, "");
    if (!rest) {
        return c.json({ error: "缺少 key" }, 400);
    }
    let key: string;
    try {
        key = decodeURIComponent(rest);
    } catch {
        return c.json({ error: "缺少 key" }, 400);
    }
    const data = await getStorage().get(key);
    if (!data) {
        return c.json({ error: "文件不存在" }, 404);
    }
    const ext = key.split(".").pop()?.toLowerCase();
    const contentType =
        ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "webp"
                ? "image/webp"
                : ext === "gif"
                  ? "image/gif"
                  : ext === "svg"
                    ? "image/svg+xml"
                    : "application/octet-stream";
    return new Response(new Blob([data as BlobPart], { type: contentType }), {
        status: 200,
        headers: { "content-type": contentType },
    });
});

app.notFound((c) => c.json({ error: "接口不存在" }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "服务器内部错误" }, 500);
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
