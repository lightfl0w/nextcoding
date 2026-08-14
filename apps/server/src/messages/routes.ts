import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import {
    publishNewMessage,
    publishUnreadCount,
    subscribeUser,
} from "./messageBus.js";
import {
    countUnreadMessages,
    findConversation,
    findOrCreateConversation,
    findUserProfile,
    insertMessage,
    listConversations,
    listMessages,
    MESSAGE_PAGE_SIZE,
    markConversationRead,
    userExists,
} from "./repository.js";

const MESSAGE_MAX_LENGTH = 1000;
const HEARTBEAT_INTERVAL_MS = 15_000;

export const messageRoutes = new Hono<AuthenticatedEnv>()
    .use(requireSession)
    .get("/conversations", async (c) => {
        const userId = c.get("userId");
        const rows = await listConversations(userId);
        return c.json(rows.map(toConversation));
    })
    .post("/conversations", async (c) => {
        const userId = c.get("userId");
        const body = await readJsonBody(c);
        const otherUserId = readTrimmed(body, "userId");

        if (!otherUserId) {
            return jsonError(c, "用户 ID 不能为空", 400);
        }
        if (otherUserId === userId) {
            return jsonError(c, "不能与自己创建会话", 400);
        }

        const otherUserExists = await userExists(otherUserId);
        if (!otherUserExists) {
            return jsonError(c, "用户不存在", 404);
        }

        const conv = await findOrCreateConversation(userId, otherUserId);
        return c.json({
            id: conv.id,
            user1Id: conv.user1Id,
            user2Id: conv.user2Id,
            lastMessageAt: conv.lastMessageAt,
        });
    })
    .get("/conversations/:id", async (c) => {
        const userId = c.get("userId");
        const conversationId = c.req.param("id");

        const conv = await findConversation(conversationId);
        if (!conv) {
            return jsonError(c, "会话不存在", 404);
        }
        if (conv.user1Id !== userId && conv.user2Id !== userId) {
            return jsonError(c, "无权访问此会话", 403);
        }

        const limit = clampMessageLimit(c.req.query("limit"));
        const offset = Number(c.req.query("offset")) || 0;

        const rows = await listMessages(conversationId, limit, offset);
        return c.json(rows.map(toMessage));
    })
    .post("/conversations/:id", async (c) => {
        const userId = c.get("userId");
        const conversationId = c.req.param("id");

        const conv = await findConversation(conversationId);
        if (!conv) {
            return jsonError(c, "会话不存在", 404);
        }
        if (conv.user1Id !== userId && conv.user2Id !== userId) {
            return jsonError(c, "无权访问此会话", 403);
        }

        const body = await readJsonBody(c);
        const content = readTrimmed(body, "content");

        if (!content) {
            return jsonError(c, "消息内容不能为空", 400);
        }
        if (content.length > MESSAGE_MAX_LENGTH) {
            return jsonError(c, `消息最多 ${MESSAGE_MAX_LENGTH} 字`, 400);
        }

        const inserted = await insertMessage(conversationId, userId, content);

        const sender = await findUserProfile(userId);

        const recipientId =
            conv.user1Id === userId ? conv.user2Id : conv.user1Id;

        publishNewMessage(recipientId, conversationId, {
            id: inserted.id,
            senderId: userId,
            content,
            createdAt: inserted.createdAt,
            senderName: sender?.name ?? null,
            senderImage: sender?.image ?? null,
        });

        const unreadCount = await countUnreadMessages(recipientId);
        publishUnreadCount(recipientId, unreadCount);

        return c.json(
            {
                id: inserted.id,
                conversationId,
                senderId: userId,
                content,
                createdAt: inserted.createdAt,
                sender: {
                    id: userId,
                    name: sender?.name ?? null,
                    image: sender?.image ?? null,
                },
            },
            201,
        );
    })
    .get("/unread-count", async (c) => {
        const userId = c.get("userId");
        const total = await countUnreadMessages(userId);
        return c.json({ count: total });
    })
    .post("/conversations/:id/read", async (c) => {
        const userId = c.get("userId");
        const conversationId = c.req.param("id");

        const conv = await findConversation(conversationId);
        if (!conv) {
            return jsonError(c, "会话不存在", 404);
        }
        if (conv.user1Id !== userId && conv.user2Id !== userId) {
            return jsonError(c, "无权访问此会话", 403);
        }

        await markConversationRead(conversationId, userId);
        const unreadCount = await countUnreadMessages(userId);
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

const MESSAGE_LIMIT_MAX = 100;

function clampMessageLimit(raw: string | undefined): number {
    const requested = Number(raw);
    if (!Number.isFinite(requested) || requested <= 0) {
        return MESSAGE_PAGE_SIZE;
    }
    return Math.min(requested, MESSAGE_LIMIT_MAX);
}

interface ConversationRow {
    id: string;
    user1Id: string;
    user2Id: string;
    lastMessageAt: Date | null;
    createdAt: Date;
    otherUserId: string;
    otherUserName: string | null;
    otherUserImage: string | null;
    lastMessageContent: string | null;
    unreadCount: number;
}

function toConversation(row: ConversationRow) {
    return {
        id: row.id,
        otherUser: {
            id: row.otherUserId,
            name: row.otherUserName,
            image: row.otherUserImage,
        },
        lastMessage: row.lastMessageContent,
        lastMessageAt: row.lastMessageAt,
        createdAt: row.createdAt,
        unreadCount: row.unreadCount,
    };
}

interface MessageRow {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    read: boolean;
    createdAt: Date;
    senderName: string | null;
    senderImage: string | null;
}

function toMessage(row: MessageRow) {
    return {
        id: row.id,
        conversationId: row.conversationId,
        senderId: row.senderId,
        content: row.content,
        read: row.read,
        createdAt: row.createdAt,
        sender: {
            id: row.senderId,
            name: row.senderName,
            image: row.senderImage,
        },
    };
}
