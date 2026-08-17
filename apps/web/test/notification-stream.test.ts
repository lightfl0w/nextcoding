import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeNotificationStream } from "../src/lib/notificationStream";
import { resetSharedSocket } from "../src/lib/socket";

type FakeInstance = {
    url: string;
    readyState: number;
    onopen: (() => void) | null;
    onmessage: ((evt: { data: unknown }) => void) | null;
    onerror: ((err: unknown) => void) | null;
    onclose: (() => void) | null;
    closeCalled: boolean;
    closeCode: number | null;
    pushWireMessage: (event: string, data: unknown) => void;
    triggerOpen: () => void;
    triggerAbnormalClose: () => void;
};

const instances: FakeInstance[] = [];

function MockWebSocket(this: FakeInstance, url: string) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.closeCalled = false;
    this.closeCode = null;
    instances.push(this);
    this.pushWireMessage = (event: string, data: unknown) => {
        const msg = JSON.stringify({ event, data });
        this.onmessage?.({ data: msg });
    };
    this.triggerOpen = () => {
        this.readyState = 1;
        this.onopen?.();
    };
    this.triggerAbnormalClose = () => {
        this.readyState = 3;
        this.onclose?.();
    };
}

Object.assign(MockWebSocket.prototype, {
    close(code = 1000) {
        const self = this as unknown as FakeInstance;
        self.closeCalled = true;
        self.closeCode = code;
        self.readyState = 3;
    },
});

const READY_STATES = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

describe("notificationStream (原生 WebSocket)", () => {
    beforeEach(() => {
        instances.length = 0;
        Object.assign(globalThis, {
            WebSocket: MockWebSocket as unknown as typeof WebSocket,
        });
        Object.assign(MockWebSocket, READY_STATES);
        vi.resetModules();
    });

    afterEach(() => {
        resetSharedSocket();
        vi.clearAllMocks();
    });

    it("首个订阅建立 WebSocket 连接，端点为 /ws", () => {
        const unsubscribe = subscribeNotificationStream("u1", vi.fn());
        expect(instances).toHaveLength(1);
        expect(instances[0].url).toMatch(/\/ws$/);
        unsubscribe();
        expect(instances[0].closeCalled).toBe(true);
    });

    it("同一用户多个订阅共享连接，notification:unread 事件推给所有订阅", () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubFirst = subscribeNotificationStream("u1", first);
        const unsubSecond = subscribeNotificationStream("u1", second);
        expect(instances).toHaveLength(1);
        const sock = instances[0];
        sock.triggerOpen();
        sock.pushWireMessage("notification:unread", { unreadCount: 3 });
        expect(first).toHaveBeenCalledWith({ type: "unread", unreadCount: 3 });
        expect(second).toHaveBeenCalledWith({ type: "unread", unreadCount: 3 });
        unsubFirst();
        expect(sock.closeCalled).toBe(false);
        unsubSecond();
        expect(sock.closeCalled).toBe(true);
    });

    it("open 触发 reconnected，重连后再次触发", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeNotificationStream("u1", handler);
        instances[0].triggerOpen();
        expect(handler).toHaveBeenCalledWith({ type: "reconnected" });
        vi.useFakeTimers();
        instances[0].triggerAbnormalClose();
        vi.runAllTimers();
        vi.useRealTimers();
        expect(instances).toHaveLength(2);
        instances[1].triggerOpen();
        expect(handler).toHaveBeenCalledTimes(2);
        unsubscribe();
    });

    it("notification:new 事件解析为 {type:notification, notification, unreadCount}", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeNotificationStream("u1", handler);
        instances[0].triggerOpen();
        const payload = {
            notification: { id: "n1", type: "spark" },
            unreadCount: 5,
        };
        instances[0].pushWireMessage("notification:new", payload);
        expect(handler).toHaveBeenCalledWith({
            type: "notification",
            notification: payload.notification,
            unreadCount: 5,
        });
        unsubscribe();
    });

    it("最后一个订阅取消后断开且不重连", () => {
        const unsubA = subscribeNotificationStream("userA", vi.fn());
        expect(instances[0].closeCalled).toBe(false);
        unsubA();
        expect(instances[0].closeCalled).toBe(true);
        vi.useFakeTimers();
        vi.runAllTimers();
        vi.useRealTimers();
        expect(instances).toHaveLength(1);

        const unsubB = subscribeNotificationStream("userA", vi.fn());
        expect(instances).toHaveLength(2);
        unsubB();
    });
});
