type Listener = (...args: unknown[]) => void;

type WireMessage = { event: string; data: unknown };

interface SharedSocket {
    ws: WebSocket;
    eventRefs: Map<string, Set<Listener>>;
    connectHandlers: Set<() => void>;
    totalRefs: number;
    closing: boolean;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    reconnectDelay: number;
    shouldReconnect: boolean;
}

let shared: SharedSocket | null = null;

function getWsUrl(): string {
    const backend = import.meta.env.BACKEND_URL;
    const wsProto = backend.startsWith("https") ? "wss:" : "ws:";
    const host = backend.replace(/^https?:\/\//, "");
    return `${wsProto}//${host}/ws`;
}

const MAX_RECONNECT_DELAY = 10000;
const INITIAL_RECONNECT_DELAY = 1000;

function createSocket(): WebSocket {
    return new WebSocket(getWsUrl());
}

function scheduleReconnect(s: SharedSocket): void {
    if (s.reconnectTimer !== null || !s.shouldReconnect) {
        return;
    }
    const delay = s.reconnectDelay;
    s.reconnectDelay = Math.min(MAX_RECONNECT_DELAY, s.reconnectDelay * 2);
    s.reconnectTimer = setTimeout(() => {
        s.reconnectTimer = null;
        if (s.totalRefs === 0 || s.closing) {
            return;
        }
        const ws = createSocket();
        bindSocket(s, ws);
    }, delay);
}

function bindSocket(s: SharedSocket, ws: WebSocket): void {
    s.ws = ws;

    ws.onopen = () => {
        s.reconnectDelay = INITIAL_RECONNECT_DELAY;
        for (const h of s.connectHandlers) {
            try {
                h();
            } catch {}
        }
    };

    ws.onmessage = (evt) => {
        if (typeof evt.data !== "string") {
            return;
        }
        let msg: WireMessage;
        try {
            msg = JSON.parse(evt.data) as WireMessage;
        } catch {
            return;
        }
        if (!msg || typeof msg.event !== "string") {
            return;
        }
        const set = s.eventRefs.get(msg.event);
        if (!set) {
            return;
        }
        for (const fn of set) {
            try {
                fn(msg.data);
            } catch {}
        }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
        if (s.closing || s.totalRefs === 0) {
            return;
        }
        scheduleReconnect(s);
    };
}

/**
 * 订阅一个 WebSocket 事件，返回取消订阅函数。
 * 内部共享同一连接；引用计数归零时自动断开。
 *
 * @param eventName - 服务端 JSON 帧里的 event 字段名
 * @param listener  - 回调，入参为 JSON 里的 data
 * @param onConnect - 连接建立（含重连）时触发，可选
 */
export function subscribeSocketEvent(
    eventName: string,
    listener: Listener,
    onConnect?: () => void,
): () => void {
    if (!shared) {
        const ws = createSocket();
        shared = {
            ws,
            eventRefs: new Map(),
            connectHandlers: new Set(),
            totalRefs: 0,
            closing: false,
            reconnectTimer: null,
            reconnectDelay: INITIAL_RECONNECT_DELAY,
            shouldReconnect: true,
        };
        bindSocket(shared, ws);
    }
    const s = shared;

    let set = s.eventRefs.get(eventName);
    if (!set) {
        set = new Set();
        s.eventRefs.set(eventName, set);
    }
    set.add(listener);

    let connectHandler: (() => void) | null = null;
    if (onConnect) {
        connectHandler = onConnect;
        s.connectHandlers.add(connectHandler);

        if (s.ws.readyState === WebSocket.OPEN) {
            queueMicrotask(connectHandler);
        }
    }

    s.totalRefs++;

    return () => {
        const currentSet = s.eventRefs.get(eventName);
        if (currentSet) {
            currentSet.delete(listener);
            if (currentSet.size === 0) {
                s.eventRefs.delete(eventName);
            }
        }

        if (connectHandler) {
            s.connectHandlers.delete(connectHandler);
        }
        s.totalRefs--;

        if (s.totalRefs === 0) {
            s.closing = true;
            s.shouldReconnect = false;
            if (s.reconnectTimer !== null) {
                clearTimeout(s.reconnectTimer);
                s.reconnectTimer = null;
            }
            try {
                s.ws.close(1000);
            } catch {}
            shared = null;
        }
    };
}

/**
 * 关闭共享连接并重置内部状态。
 * 用于测试或组件卸载时强制清理。
 */
export function resetSharedSocket(): void {
    if (!shared) {
        return;
    }
    shared.shouldReconnect = false;
    if (shared.reconnectTimer !== null) {
        clearTimeout(shared.reconnectTimer);
        shared.reconnectTimer = null;
    }
    try {
        shared.ws.close(1000);
    } catch {}
    shared = null;
}
