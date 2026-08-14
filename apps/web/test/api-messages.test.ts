import { describe, expect, it } from "vitest";
import {
    conversationMessagesPath,
    conversationPath,
    conversationsPath,
    unreadMessageCountPath,
} from "../src/lib/api/messages";

describe("api/messages", () => {
    describe("conversationsPath", () => {
        it("返回会话列表路径", () => {
            expect(conversationsPath()).toBe("/api/messages/conversations");
        });
    });

    describe("conversationPath", () => {
        it("返回指定会话路径", () => {
            expect(conversationPath("c1")).toBe(
                "/api/messages/conversations/c1",
            );
        });

        it("不同 id 返回不同路径", () => {
            expect(conversationPath("abc")).toBe(
                "/api/messages/conversations/abc",
            );
        });
    });

    describe("conversationMessagesPath", () => {
        it("无参数返回基础路径", () => {
            expect(conversationMessagesPath("c1")).toBe(
                "/api/messages/conversations/c1",
            );
        });

        it("拼接 limit 参数", () => {
            const path = conversationMessagesPath("c1", 20);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("20");
        });

        it("拼接 offset 参数", () => {
            const path = conversationMessagesPath("c1", undefined, 40);
            expect(
                new URL(path, "http://localhost").searchParams.get("offset"),
            ).toBe("40");
        });

        it("同时拼接 limit 和 offset", () => {
            const path = conversationMessagesPath("c1", 20, 40);
            expect(path).toContain("limit=20");
            expect(path).toContain("offset=40");
        });
    });

    describe("unreadMessageCountPath", () => {
        it("返回未读消息数路径", () => {
            expect(unreadMessageCountPath()).toBe("/api/messages/unread-count");
        });
    });
});
