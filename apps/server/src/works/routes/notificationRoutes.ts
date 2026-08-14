import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { type AuthenticatedEnv, requireSession } from "../../http/guards.js";
import {
    publishAllRead,
    publishUnreadCount,
    subscribeUser,
} from "../notificationBus.js";
import { toNotification } from "../serializers.js";
import {
    countUnreadNotifications,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NOTIFICATION_PAGE_SIZE,
} from "../socialRepository.js";

const HEARTBEAT_INTERVAL_MS = 15_000;

export const notificationRoutes = new Hono<AuthenticatedEnv>()
    .use(requireSession)
    .get("/", async (c) => {
        const rows = await listNotifications(
            c.get("userId"),
            NOTIFICATION_PAGE_SIZE,
        );
        return c.json(rows.map(toNotification));
    })
    .get("/unread-count", async (c) => {
        return c.json({
            count: await countUnreadNotifications(c.get("userId")),
        });
    })
    .post("/read-all", async (c) => {
        const userId = c.get("userId");
        await markAllNotificationsRead(userId);
        publishAllRead(userId);
        return c.json({ ok: true });
    })
    .post("/:id/read", async (c) => {
        const userId = c.get("userId");
        await markNotificationRead(c.req.param("id"), userId);
        const unreadCount = await countUnreadNotifications(userId);
        publishUnreadCount(userId, unreadCount);
        return c.json({ ok: true, unreadCount });
    })
    .get("/stream", (c) => {
        const userId = c.get("userId");
        return streamSSE(c, async (stream) => {
            const unsubscribe = subscribeUser(userId, (event) => {
                void stream.writeSSE({
                    event: event.type,
                    data: JSON.stringify(event.payload),
                });
            });
            const heartbeat = setInterval(() => {
                if (!stream.aborted) {
                    void stream.write(": hb\n\n");
                }
            }, HEARTBEAT_INTERVAL_MS);
            const cleanup = () => {
                unsubscribe();
                clearInterval(heartbeat);
                c.req.raw.signal.removeEventListener("abort", cleanup);
            };
            c.req.raw.signal.addEventListener("abort", cleanup);
            stream.onAbort(cleanup);
            await new Promise<void>((resolve) => {
                stream.onAbort(() => resolve());
            });
        });
    });
