import { upgradeWebSocket } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import type { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

export const wss = new WebSocketServer({ noServer: true });

type WsWithMeta = WebSocket & {
    __wsPingTimer?: ReturnType<typeof setInterval>;
    __wsAlive?: boolean;
};

const ROOM_PREFIX = "user:";
const HEARTBEAT_INTERVAL_MS = 30_000;

type UserConnections = {
    sockets: Set<WebSocket>;
};

const rooms = new Map<string, UserConnections>();

function userRoom(userId: string): string {
    return `${ROOM_PREFIX}${userId}`;
}

function startHeartbeat(ws: WsWithMeta): void {
    ws.__wsAlive = true;
    ws.__wsPingTimer = setInterval(() => {
        if (ws.readyState !== 1) {
            stopHeartbeat(ws);
            return;
        }
        if (!ws.__wsAlive) {
            stopHeartbeat(ws);
            try {
                ws.close(1000, "ping timeout");
            } catch {}
            return;
        }
        ws.__wsAlive = false;
        try {
            ws.ping();
        } catch {}
    }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(ws: WsWithMeta): void {
    if (ws.__wsPingTimer !== undefined) {
        clearInterval(ws.__wsPingTimer);
        ws.__wsPingTimer = undefined;
    }
}

function addToRoom(userId: string, ws: WebSocket): void {
    const key = userRoom(userId);
    let room = rooms.get(key);
    if (!room) {
        room = { sockets: new Set() };
        rooms.set(key, room);
    }
    room.sockets.add(ws);
    startHeartbeat(ws as WsWithMeta);
}

function removeFromRoom(userId: string, ws: WebSocket): void {
    const key = userRoom(userId);
    const room = rooms.get(key);
    stopHeartbeat(ws as WsWithMeta);
    if (!room) {
        return;
    }
    room.sockets.delete(ws);
    if (room.sockets.size === 0) {
        rooms.delete(key);
    }
}

/**
 * 向指定用户所有在线连接广播事件。
 * @param userId - 目标用户 ID
 * @param eventName - 事件名，与前端 subscribeSocketEvent 对应
 * @param payload - 事件数据
 */
export function emitToUser(
    userId: string,
    eventName: string,
    payload: unknown,
): void {
    const room = rooms.get(userRoom(userId));
    if (!room || room.sockets.size === 0) {
        return;
    }
    const text = JSON.stringify({ event: eventName, data: payload });
    for (const socket of room.sockets) {
        if (socket.readyState === 1) {
            socket.send(text);
        }
    }
}

const wsAuthMiddleware = createMiddleware(async (c, next) => {
    const session = await auth.api
        .getSession({ headers: c.req.raw.headers })
        .catch(() => null);
    if (!session?.user) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("userId", session.user.id);
    await next();
});

/**
 * 注册 /ws 路由。必须在 cors 等修改 headers 的中间件之前调用，
 * 否则 upgradeWebSocket 会与修改 headers 的中间件冲突。
 */
export function registerWsRoutes(app: Hono): void {
    app.get(
        "/ws",
        wsAuthMiddleware,
        upgradeWebSocket((c) => ({
            onOpen: (_evt, ws) => {
                const userId = c.get("userId") as string;
                const raw = ws.raw as unknown as WsWithMeta;
                addToRoom(userId, raw);
                raw.on("pong", () => {
                    raw.__wsAlive = true;
                });
            },
            onMessage: (_evt, ws) => {
                const raw = ws.raw as unknown as WsWithMeta;
                raw.__wsAlive = true;
            },
            onClose: (_evt, ws) => {
                removeFromRoom(
                    c.get("userId") as string,
                    ws.raw as unknown as WebSocket,
                );
            },
            onError: (_evt, ws) => {
                removeFromRoom(
                    c.get("userId") as string,
                    ws.raw as unknown as WebSocket,
                );
            },
        })),
    );
}
