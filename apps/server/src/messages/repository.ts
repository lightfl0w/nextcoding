import { conversation, db, message, user } from "@nextcoding/db";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";

export const MESSAGE_PAGE_SIZE = 50;

export function userExists(userId: string) {
    return db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .get()
        .then((row) => Boolean(row));
}

export function findUserProfile(userId: string) {
    return db
        .select({ name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .get();
}

export async function findOrCreateConversation(
    user1Id: string,
    user2Id: string,
) {
    const [smaller, larger] =
        user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const existing = await findConversationBetween(smaller, larger);
    if (existing) {
        return existing;
    }

    const id = crypto.randomUUID();
    await db.insert(conversation).values({
        id,
        user1Id: smaller,
        user2Id: larger,
    });

    return { id, user1Id: smaller, user2Id: larger, lastMessageAt: null };
}

export function listConversations(userId: string) {
    return db
        .select({
            id: conversation.id,
            user1Id: conversation.user1Id,
            user2Id: conversation.user2Id,
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
            otherUserId: sql<string>`CASE WHEN ${conversation.user1Id} = ${userId} THEN ${conversation.user2Id} ELSE ${conversation.user1Id} END`,
            otherUserName: user.name,
            otherUserImage: user.image,
            lastMessageContent: sql<string | null>`(
                SELECT m.content FROM message m
                WHERE m.conversation_id = ${conversation.id}
                ORDER BY m.created_at DESC LIMIT 1
            )`,
            unreadCount: sql<number>`(
                SELECT count(*) FROM message m2
                WHERE m2.conversation_id = ${conversation.id}
                  AND m2.sender_id <> ${userId}
                  AND m2.read = 0
            )`,
        })
        .from(conversation)
        .leftJoin(
            user,
            eq(
                user.id,
                sql`CASE WHEN ${conversation.user1Id} = ${userId} THEN ${conversation.user2Id} ELSE ${conversation.user1Id} END`,
            ),
        )
        .where(
            sql`(${conversation.user1Id} = ${userId} OR ${conversation.user2Id} = ${userId})`,
        )
        .orderBy(desc(conversation.lastMessageAt));
}

export function listMessages(
    conversationId: string,
    limit = MESSAGE_PAGE_SIZE,
    offset = 0,
) {
    return db
        .select({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            read: message.read,
            recalled: message.recalled,
            createdAt: message.createdAt,
            senderName: user.name,
            senderImage: user.image,
        })
        .from(message)
        .leftJoin(user, eq(user.id, message.senderId))
        .where(eq(message.conversationId, conversationId))
        .orderBy(desc(message.createdAt))
        .limit(limit)
        .offset(offset);
}

export async function insertMessage(
    conversationId: string,
    senderId: string,
    content: string,
) {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(message).values({
        id,
        conversationId,
        senderId,
        content,
        createdAt: now,
    });

    await db
        .update(conversation)
        .set({ lastMessageAt: now })
        .where(eq(conversation.id, conversationId));

    return { id, conversationId, senderId, content, createdAt: now };
}

export function countUnreadMessages(userId: string) {
    return db
        .select({ total: count() })
        .from(message)
        .innerJoin(conversation, eq(conversation.id, message.conversationId))
        .where(
            and(
                sql`(${conversation.user1Id} = ${userId} OR ${conversation.user2Id} = ${userId})`,
                ne(message.senderId, userId),
                eq(message.read, false),
            ),
        )
        .get()
        .then((row) => row?.total ?? 0);
}

export function markConversationRead(conversationId: string, userId: string) {
    return db
        .update(message)
        .set({ read: true })
        .where(
            and(
                eq(message.conversationId, conversationId),
                ne(message.senderId, userId),
                eq(message.read, false),
            ),
        );
}

export function findConversation(conversationId: string) {
    return db
        .select({
            id: conversation.id,
            user1Id: conversation.user1Id,
            user2Id: conversation.user2Id,
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
        })
        .from(conversation)
        .where(eq(conversation.id, conversationId))
        .get();
}

export function findConversationBetween(user1Id: string, user2Id: string) {
    const [smaller, larger] =
        user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    return db
        .select({
            id: conversation.id,
            user1Id: conversation.user1Id,
            user2Id: conversation.user2Id,
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
        })
        .from(conversation)
        .where(
            and(
                eq(conversation.user1Id, smaller),
                eq(conversation.user2Id, larger),
            ),
        )
        .get();
}

export function findMessage(messageId: string) {
    return db
        .select({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            recalled: message.recalled,
        })
        .from(message)
        .where(eq(message.id, messageId))
        .get();
}

export async function recallMessage(messageId: string, senderId: string) {
    await db
        .update(message)
        .set({ recalled: true })
        .where(and(eq(message.id, messageId), eq(message.senderId, senderId)));
    return db
        .select({ recalled: message.recalled })
        .from(message)
        .where(eq(message.id, messageId))
        .get();
}
