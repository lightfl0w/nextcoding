import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as messageBus from "../src/messages/messageBus.js";
import * as msgRepo from "../src/messages/repository.js";
import { messageRoutes } from "../src/messages/routes.js";
import { mockGetSession } from "./setup";

describe("messageRoutes", () => {
    function app() {
        return new Hono().route("/api/messages", messageRoutes);
    }

    function conversationRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "conv-1",
            user1Id: "user-1",
            user2Id: "user-2",
            lastMessageAt: new Date("2026-01-02T00:00:00Z"),
            createdAt: new Date("2026-01-01T00:00:00Z"),
            otherUserId: "user-2",
            otherUserName: "李四",
            otherUserImage: null,
            lastMessageContent: "你好",
            unreadCount: 1,
            ...overrides,
        };
    }

    function messageRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "m1",
            conversationId: "conv-1",
            senderId: "user-2",
            content: "你好",
            read: false,
            createdAt: new Date("2026-01-02T00:00:00Z"),
            senderName: "李四",
            senderImage: null,
            ...overrides,
        };
    }

    describe("GET /conversations", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/messages/conversations");
            expect(res.status).toBe(401);
        });

        it("返回会话列表", async () => {
            vi.mocked(msgRepo.listConversations).mockResolvedValue([
                conversationRow(),
            ] as never);
            const res = await app().request("/api/messages/conversations");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                id: "conv-1",
                otherUser: { id: "user-2", name: "李四" },
                lastMessage: "你好",
                unreadCount: 1,
            });
        });

        it("无消息时 lastMessage 为 null", async () => {
            vi.mocked(msgRepo.listConversations).mockResolvedValue([
                conversationRow({ lastMessageContent: null }),
            ] as never);
            const res = await app().request("/api/messages/conversations");
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ lastMessage: null });
        });
    });

    describe("POST /conversations", () => {
        it("缺少 userId 返回 400", async () => {
            const res = await app().request("/api/messages/conversations", {
                method: "POST",
                body: JSON.stringify({}),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "用户 ID 不能为空" });
        });

        it("不能与自己创建会话", async () => {
            const res = await app().request("/api/messages/conversations", {
                method: "POST",
                body: JSON.stringify({ userId: "user-1" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "不能与自己创建会话" });
        });

        it("对方用户不存在返回 404", async () => {
            vi.mocked(msgRepo.userExists).mockResolvedValue(false);
            const res = await app().request("/api/messages/conversations", {
                method: "POST",
                body: JSON.stringify({ userId: "ghost" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "用户不存在" });
        });

        it("创建会话成功", async () => {
            vi.mocked(msgRepo.userExists).mockResolvedValue(true);
            vi.mocked(msgRepo.findOrCreateConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
            });
            const res = await app().request("/api/messages/conversations", {
                method: "POST",
                body: JSON.stringify({ userId: "user-2" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ id: "conv-1", user1Id: "user-1" });
        });
    });

    describe("GET /conversations/:id", () => {
        it("会话不存在返回 404", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue(undefined);
            const res = await app().request("/api/messages/conversations/x");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "会话不存在" });
        });

        it("非参与者返回 403", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "a",
                user2Id: "b",
                lastMessageAt: null,
                createdAt: new Date(),
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1",
            );
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({ error: "无权访问此会话" });
        });

        it("返回消息列表", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
                createdAt: new Date(),
            });
            vi.mocked(msgRepo.listMessages).mockResolvedValue([
                messageRow(),
            ] as never);
            const res = await app().request(
                "/api/messages/conversations/conv-1",
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                id: "m1",
                content: "你好",
                sender: { id: "user-2", name: "李四" },
            });
        });
    });

    describe("POST /conversations/:id", () => {
        it("消息内容为空返回 400", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
                createdAt: new Date(),
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1",
                {
                    method: "POST",
                    body: JSON.stringify({ content: "   " }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "消息内容不能为空" });
        });

        it("消息超过 1000 字返回 400", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
                createdAt: new Date(),
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1",
                {
                    method: "POST",
                    body: JSON.stringify({ content: "长".repeat(1001) }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "消息最多 1000 字",
            });
        });

        it("发送成功并推送通知", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
                createdAt: new Date(),
            });
            vi.mocked(msgRepo.insertMessage).mockResolvedValue({
                id: "m-new",
                conversationId: "conv-1",
                senderId: "user-1",
                content: "在吗",
                createdAt: new Date(),
            });
            vi.mocked(msgRepo.findUserProfile).mockResolvedValue({
                name: "张三",
                image: null,
            });
            vi.mocked(msgRepo.countUnreadMessages).mockResolvedValue(2);

            const res = await app().request(
                "/api/messages/conversations/conv-1",
                {
                    method: "POST",
                    body: JSON.stringify({ content: "在吗" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({
                id: "m-new",
                content: "在吗",
                sender: { id: "user-1", name: "张三" },
            });
            expect(messageBus.publishNewMessage).toHaveBeenCalledWith(
                "user-2",
                "conv-1",
                expect.objectContaining({ content: "在吗" }),
            );
            expect(messageBus.publishUnreadCount).toHaveBeenCalledWith(
                "user-2",
                2,
            );
        });
    });

    describe("POST /conversations/:id/recall", () => {
        function mockConv() {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
                createdAt: new Date(),
            });
        }

        it("消息不存在返回 404", async () => {
            mockConv();
            vi.mocked(msgRepo.findMessage).mockResolvedValue(undefined);
            const res = await app().request(
                "/api/messages/conversations/conv-1/recall",
                {
                    method: "POST",
                    body: JSON.stringify({ messageId: "m-x" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "消息不存在" });
        });

        it("消息属于其他会话返回 404", async () => {
            mockConv();
            vi.mocked(msgRepo.findMessage).mockResolvedValue({
                id: "m1",
                conversationId: "conv-other",
                senderId: "user-1",
                recalled: false,
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1/recall",
                {
                    method: "POST",
                    body: JSON.stringify({ messageId: "m1" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(404);
        });

        it("只能撤回自己发送的消息", async () => {
            mockConv();
            vi.mocked(msgRepo.findMessage).mockResolvedValue({
                id: "m1",
                conversationId: "conv-1",
                senderId: "user-2",
                recalled: false,
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1/recall",
                {
                    method: "POST",
                    body: JSON.stringify({ messageId: "m1" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({
                error: "只能撤回自己发送的消息",
            });
        });

        it("撤回成功并通知双方", async () => {
            mockConv();
            vi.mocked(msgRepo.findMessage).mockResolvedValue({
                id: "m1",
                conversationId: "conv-1",
                senderId: "user-1",
                recalled: false,
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1/recall",
                {
                    method: "POST",
                    body: JSON.stringify({ messageId: "m1" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });
            expect(msgRepo.recallMessage).toHaveBeenCalledWith("m1", "user-1");
            expect(messageBus.publishMessageRecalled).toHaveBeenCalledTimes(2);
            expect(messageBus.publishMessageRecalled).toHaveBeenCalledWith(
                "user-1",
                "conv-1",
                "m1",
            );
            expect(messageBus.publishMessageRecalled).toHaveBeenCalledWith(
                "user-2",
                "conv-1",
                "m1",
            );
        });

        it("重复撤回幂等返回成功且不重复通知", async () => {
            mockConv();
            vi.mocked(msgRepo.findMessage).mockResolvedValue({
                id: "m1",
                conversationId: "conv-1",
                senderId: "user-1",
                recalled: true,
            });
            const res = await app().request(
                "/api/messages/conversations/conv-1/recall",
                {
                    method: "POST",
                    body: JSON.stringify({ messageId: "m1" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(200);
            expect(msgRepo.recallMessage).not.toHaveBeenCalled();
            expect(messageBus.publishMessageRecalled).not.toHaveBeenCalled();
        });
    });

    describe("GET /unread-count", () => {
        it("返回未读消息数", async () => {
            vi.mocked(msgRepo.countUnreadMessages).mockResolvedValue(5);
            const res = await app().request("/api/messages/unread-count");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ count: 5 });
        });
    });

    describe("POST /conversations/:id/read", () => {
        it("标记已读并返回未读数", async () => {
            vi.mocked(msgRepo.findConversation).mockResolvedValue({
                id: "conv-1",
                user1Id: "user-1",
                user2Id: "user-2",
                lastMessageAt: null,
                createdAt: new Date(),
            });
            vi.mocked(msgRepo.countUnreadMessages).mockResolvedValue(0);
            const res = await app().request(
                "/api/messages/conversations/conv-1/read",
                { method: "POST" },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true, unreadCount: 0 });
            expect(msgRepo.markConversationRead).toHaveBeenCalledWith(
                "conv-1",
                "user-1",
            );
        });
    });
});
