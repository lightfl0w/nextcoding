import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../../http/guards.js";
import { publishAllRead, publishUnreadCount } from "../notificationBus.js";
import { toNotification } from "../serializers.js";
import {
    countUnreadNotifications,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NOTIFICATION_PAGE_SIZE,
} from "../socialRepository.js";

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
    });
