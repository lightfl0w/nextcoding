import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesStreamPath } from "../src/lib/api/messages";
import { subscribeMessageStream } from "../src/lib/messageStream";

class FakeEventSource {
    static instances: FakeEventSource[] = [];
    readonly url: string;
    private readonly listeners = new Map<
        string,
        Set<(event: unknown) => void>
    >();
    closed = false;

    constructor(url: string) {
        this.url = url;
        FakeEventSource.instances.push(this);
    }

    addEventListener(type: string, handler: (event: unknown) => void): void {
        let set = this.listeners.get(type);
        if (!set) {
            set = new Set();
            this.listeners.set(type, set);
        }
        set.add(handler);
    }

    close(): void {
        this.closed = true;
    }

    emit(type: string, data: string): void {
        const event = { data };
        this.listeners.get(type)?.forEach((handler) => {
            handler(event);
        });
    }
}

describe("messageStream", () => {
    beforeEach(() => {
        vi.stubGlobal("EventSource", FakeEventSource);
        FakeEventSource.instances = [];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("首个订阅建立连接，连接指向私信流地址", () => {
        const unsubscribe = subscribeMessageStream("u1", vi.fn());
        expect(FakeEventSource.instances).toHaveLength(1);
        expect(FakeEventSource.instances[0].url).toBe(messagesStreamPath());
        unsubscribe();
    });

    it("同一用户的多个订阅共享一条连接，unread 事件推给所有订阅", () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubFirst = subscribeMessageStream("u1", first);
        const unsubSecond = subscribeMessageStream("u1", second);
        expect(FakeEventSource.instances).toHaveLength(1);
        FakeEventSource.instances[0].emit(
            "unread",
            JSON.stringify({ count: 3 }),
        );
        expect(first).toHaveBeenCalledWith({ type: "unread", count: 3 });
        expect(second).toHaveBeenCalledWith({ type: "unread", count: 3 });
        unsubFirst();
        unsubSecond();
    });

    it("切换用户后重新建立连接，不复用原用户连接", () => {
        const handlerA = vi.fn();
        const handlerB = vi.fn();
        const unsubA = subscribeMessageStream("userA", handlerA);
        const unsubB = subscribeMessageStream("userB", handlerB);
        expect(FakeEventSource.instances).toHaveLength(2);
        expect(FakeEventSource.instances[0].closed).toBe(false);
        expect(FakeEventSource.instances[1].closed).toBe(false);

        FakeEventSource.instances[0].emit(
            "unread",
            JSON.stringify({ count: 1 }),
        );
        expect(handlerA).toHaveBeenCalledWith({ type: "unread", count: 1 });
        expect(handlerB).not.toHaveBeenCalled();

        FakeEventSource.instances[1].emit(
            "unread",
            JSON.stringify({ count: 2 }),
        );
        expect(handlerB).toHaveBeenCalledWith({ type: "unread", count: 2 });
        expect(handlerA).toHaveBeenCalledTimes(1);
        unsubA();
        unsubB();
    });

    it("message 事件透传会话与消息", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeMessageStream("u1", handler);
        const payload = {
            conversationId: "c1",
            message: { id: "m1", content: "你好" },
        };
        FakeEventSource.instances[0].emit("message", JSON.stringify(payload));
        expect(handler).toHaveBeenCalledWith({
            type: "message",
            conversationId: "c1",
            message: payload.message,
        });
        unsubscribe();
    });

    it("最后一个订阅取消后断开对应用户的连接", () => {
        const unsubA = subscribeMessageStream("userA", vi.fn());
        const unsubB = subscribeMessageStream("userB", vi.fn());
        expect(FakeEventSource.instances).toHaveLength(2);
        unsubA();
        expect(FakeEventSource.instances[0].closed).toBe(true);
        expect(FakeEventSource.instances[1].closed).toBe(false);
        unsubB();
        expect(FakeEventSource.instances[1].closed).toBe(true);

        subscribeMessageStream("userA", vi.fn());
        expect(FakeEventSource.instances).toHaveLength(3);
    });
});
