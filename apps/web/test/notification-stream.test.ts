import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsStreamPath } from "../src/lib/api";
import { subscribeNotificationStream } from "../src/lib/notificationStream";

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

describe("notificationStream", () => {
    beforeEach(() => {
        vi.stubGlobal("EventSource", FakeEventSource);
        FakeEventSource.instances = [];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("首个订阅建立连接，连接指向通知流地址", () => {
        const unsubscribe = subscribeNotificationStream("u1", vi.fn());
        expect(FakeEventSource.instances).toHaveLength(1);
        expect(FakeEventSource.instances[0].url).toBe(
            notificationsStreamPath(),
        );
        unsubscribe();
    });

    it("同一用户的多个订阅共享一条连接", () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubFirst = subscribeNotificationStream("u1", first);
        const unsubSecond = subscribeNotificationStream("u1", second);
        expect(FakeEventSource.instances).toHaveLength(1);
        FakeEventSource.instances[0].emit(
            "unread",
            JSON.stringify({ unreadCount: 3 }),
        );
        expect(first).toHaveBeenCalledWith({ type: "unread", unreadCount: 3 });
        expect(second).toHaveBeenCalledWith({ type: "unread", unreadCount: 3 });
        unsubFirst();
        unsubSecond();
    });

    it("切换用户后重新建立连接，不复用原用户连接", () => {
        const handlerA = vi.fn();
        const handlerB = vi.fn();
        const unsubA = subscribeNotificationStream("userA", handlerA);
        const unsubB = subscribeNotificationStream("userB", handlerB);
        expect(FakeEventSource.instances).toHaveLength(2);
        expect(FakeEventSource.instances[0].closed).toBe(false);
        expect(FakeEventSource.instances[1].closed).toBe(false);

        FakeEventSource.instances[0].emit(
            "unread",
            JSON.stringify({ unreadCount: 1 }),
        );
        expect(handlerA).toHaveBeenCalledWith({
            type: "unread",
            unreadCount: 1,
        });
        expect(handlerB).not.toHaveBeenCalled();

        FakeEventSource.instances[1].emit(
            "unread",
            JSON.stringify({ unreadCount: 2 }),
        );
        expect(handlerB).toHaveBeenCalledWith({
            type: "unread",
            unreadCount: 2,
        });
        expect(handlerA).toHaveBeenCalledTimes(1);
        unsubA();
        unsubB();
    });

    it("notification 事件透传通知与未读数", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeNotificationStream("u1", handler);
        const payload = {
            notification: { id: "n1", type: "spark" },
            unreadCount: 5,
        };
        FakeEventSource.instances[0].emit(
            "notification",
            JSON.stringify(payload),
        );
        expect(handler).toHaveBeenCalledWith({
            type: "notification",
            notification: payload.notification,
            unreadCount: 5,
        });
        unsubscribe();
    });

    it("最后一个订阅取消后断开对应用户的连接", () => {
        const unsubA = subscribeNotificationStream("userA", vi.fn());
        const unsubB = subscribeNotificationStream("userB", vi.fn());
        expect(FakeEventSource.instances).toHaveLength(2);
        unsubA();
        expect(FakeEventSource.instances[0].closed).toBe(true);
        expect(FakeEventSource.instances[1].closed).toBe(false);
        unsubB();
        expect(FakeEventSource.instances[1].closed).toBe(true);

        subscribeNotificationStream("userA", vi.fn());
        expect(FakeEventSource.instances).toHaveLength(3);
    });
});
