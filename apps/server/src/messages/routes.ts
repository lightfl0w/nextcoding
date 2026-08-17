import type { Context } from "hono";
import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import {
    publishMessageRecalled,
    publishNewMessage,
    publishUnreadCount,
} from "./messageBus.js";
import {
    countUnreadMessages,
    findConversation,
    findMessage,
    findOrCreateConversation,
    findUserProfile,
    insertMessage,
    listConversations,
    listMessages,
    MESSAGE_PAGE_SIZE,
    markConversationRead,
    recallMessage,
    userExists,
} from "./repository.js";

const MESSAGE_MAX_LENGTH = 1000;
const MESSAGE_LIMIT_MAX = 100;

type ChatEnv = AuthenticatedEnv;

export const messageRoutes = new Hono<ChatEnv>()
    .use(requireSession)
    .get("/conversations", async (c) => {
        const rows = await listConversations(c.get("userId"));
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
        if (!(await userExists(otherUserId))) {
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
        const { conv, error } = await accessibleConversation(c);
        if (error) {
            return error;
        }
        const limit = clampMessageLimit(c.req.query("limit"));
        const offset = Number(c.req.query("offset")) || 0;
        const rows = await listMessages(conv.id, limit, offset);
        return c.json(rows.map(toMessage));
    })
    .post("/conversations/:id", async (c) => {
        const userId = c.get("userId");
        const { conv, error } = await accessibleConversation(c);
        if (error) {
            return error;
        }

        const content = readTrimmed(await readJsonBody(c), "content");
        if (!content) {
            return jsonError(c, "消息内容不能为空", 400);
        }
        if (content.length > MESSAGE_MAX_LENGTH) {
            return jsonError(c, `消息最多 ${MESSAGE_MAX_LENGTH} 字`, 400);
        }

        const inserted = await insertMessage(conv.id, userId, content);
        const sender = await findUserProfile(userId);
        const payload = {
            id: inserted.id,
            senderId: userId,
            content,
            createdAt: inserted.createdAt,
            senderName: sender?.name ?? null,
            senderImage: sender?.image ?? null,
        };

        const recipientId = otherUserId(conv, userId);
        publishNewMessage(recipientId, conv.id, payload);
        publishUnreadCount(recipientId, await countUnreadMessages(recipientId));

        return c.json(
            {
                ...payload,
                conversationId: conv.id,
                read: false,
                sender: {
                    id: userId,
                    name: sender?.name ?? null,
                    image: sender?.image ?? null,
                },
            },
            201,
        );
    })
    .post("/conversations/:id/recall", async (c) => {
        const userId = c.get("userId");
        const { conv, error } = await accessibleConversation(c);
        if (error) {
            return error;
        }

        const messageId = readTrimmed(await readJsonBody(c), "messageId");
        if (!messageId) {
            return jsonError(c, "消息 ID 不能为空", 400);
        }

        const target = await findMessage(messageId);
        if (!target || target.conversationId !== conv.id) {
            return jsonError(c, "消息不存在", 404);
        }
        if (target.senderId !== userId) {
            return jsonError(c, "只能撤回自己发送的消息", 403);
        }
        if (!target.recalled) {
            await recallMessage(messageId, userId);
            for (const recipient of [userId, otherUserId(conv, userId)]) {
                publishMessageRecalled(recipient, conv.id, messageId);
            }
        }
        return c.json({ ok: true });
    })
    .get("/unread-count", async (c) => {
        const total = await countUnreadMessages(c.get("userId"));
        return c.json({ count: total });
    })
    .post("/conversations/:id/read", async (c) => {
        const userId = c.get("userId");
        const { conv, error } = await accessibleConversation(c);
        if (error) {
            return error;
        }

        await markConversationRead(conv.id, userId);
        const unreadCount = await countUnreadMessages(userId);
        publishUnreadCount(userId, unreadCount);
        return c.json({ ok: true, unreadCount });
    });

async function accessibleConversation(c: Context<ChatEnv>) {
    const conversationId = c.req.param("id") ?? "";
    const userId = c.get("userId");
    const conv = await findConversation(conversationId);
    if (!conv) {
        return { error: jsonError(c, "会话不存在", 404) };
    }
    if (conv.user1Id !== userId && conv.user2Id !== userId) {
        return { error: jsonError(c, "无权访问此会话", 403) };
    }
    return { conv };
}

function otherUserId(
    conv: { user1Id: string; user2Id: string },
    userId: string,
) {
    return conv.user1Id === userId ? conv.user2Id : conv.user1Id;
}

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
    recalled: boolean;
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
        recalled: row.recalled,
        createdAt: row.createdAt,
        sender: {
            id: row.senderId,
            name: row.senderName,
            image: row.senderImage,
        },
    };
}
