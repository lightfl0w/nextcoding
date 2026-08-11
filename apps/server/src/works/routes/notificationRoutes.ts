import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../guards.js";
import { toNotification } from "../serializers.js";
import {
    countUnreadNotifications,
    listNotifications,
    markAllNotificationsRead,
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
        await markAllNotificationsRead(c.get("userId"));
        return c.json({ ok: true });
    });
