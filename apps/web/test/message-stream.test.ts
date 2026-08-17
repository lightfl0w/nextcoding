import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeMessageStream } from "../src/lib/messageStream";
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

describe("messageStream", () => {
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

    it("首个订阅建立 WebSocket 连接，端点为 /ws（同源 ws://）", () => {
        const unsubscribe = subscribeMessageStream("u1", vi.fn());
        expect(instances).toHaveLength(1);

        expect(instances[0].url).toMatch(/ws:\/\/[^/]+\/ws$/);
        unsubscribe();
        expect(instances[0].closeCalled).toBe(true);
        expect(instances[0].closeCode).toBe(1000);
    });

    it("同一用户多个订阅共享同一条连接，message:unread 事件分发给所有订阅", () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubFirst = subscribeMessageStream("u1", first);
        const unsubSecond = subscribeMessageStream("u1", second);
        expect(instances).toHaveLength(1);
        const sock = instances[0];
        sock.triggerOpen();
        sock.pushWireMessage("message:unread", { count: 3 });
        expect(first).toHaveBeenCalledWith({ type: "unread", count: 3 });
        expect(second).toHaveBeenCalledWith({ type: "unread", count: 3 });
        unsubFirst();

        expect(sock.closeCalled).toBe(false);
        unsubSecond();
        expect(sock.closeCalled).toBe(true);
    });

    it("不同用户的订阅复用同一底层连接（browser 同 tab 只开一条），事件由后端 room 隔离", () => {
        const handlerA = vi.fn();
        const handlerB = vi.fn();
        const unsubA = subscribeMessageStream("userA", handlerA);
        const unsubB = subscribeMessageStream("userB", handlerB);

        expect(instances).toHaveLength(1);
        const sock = instances[0];
        sock.triggerOpen();
        sock.pushWireMessage("message:recall", {
            conversationId: "cA",
            messageId: "mA",
        });

        expect(handlerA).toHaveBeenCalledWith({
            type: "recall",
            conversationId: "cA",
            messageId: "mA",
        });
        expect(handlerB).toHaveBeenCalledWith({
            type: "recall",
            conversationId: "cA",
            messageId: "mA",
        });
        unsubA();
        unsubB();
    });

    it("message:new 事件解析为 type=message 并透传 conversationId/message", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeMessageStream("u1", handler);
        instances[0].triggerOpen();
        const data = {
            conversationId: "c1",
            message: { id: "m1", content: "你好" },
        };
        instances[0].pushWireMessage("message:new", data);
        expect(handler).toHaveBeenCalledWith({
            type: "message",
            conversationId: "c1",
            message: data.message,
        });
        unsubscribe();
    });

    it("open 事件触发 reconnected", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeMessageStream("u1", handler);
        instances[0].triggerOpen();
        expect(handler).toHaveBeenCalledWith({ type: "reconnected" });
        vi.useFakeTimers();
        instances[0].triggerAbnormalClose();
        vi.runAllTimers();
        vi.useRealTimers();
        expect(instances).toHaveLength(2);
        const newSock = instances[1];
        newSock.triggerOpen();
        expect(handler).toHaveBeenCalledWith({ type: "reconnected" });
        unsubscribe();
    });

    it("最后一个订阅取消后主动关闭且不重连", () => {
        const unsubA = subscribeMessageStream("userA", vi.fn());
        expect(instances[0].closeCalled).toBe(false);
        unsubA();
        expect(instances[0].closeCalled).toBe(true);

        vi.useFakeTimers();
        vi.runAllTimers();
        vi.useRealTimers();
        expect(instances).toHaveLength(1);
    });
});
