import { Spinner, toast } from "@heroui/react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "~/components/messages/MessageBubble";
import { MessageInput } from "~/components/messages/MessageInput";
import { EmptyState } from "~/components/ui/EmptyState";
import { LoadingState } from "~/components/ui/LoadingState";
import { useAuth } from "~/hooks/useAuth";
import { useMessages } from "~/hooks/useMessages";
import {
    conversationMessagesPath,
    fetchMessages,
    type Message,
    markConversationRead,
    recallMessage,
    sendMessage,
} from "~/lib/api/messages";
import { subscribeMessageStream } from "~/lib/messageStream";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/chat/$id")({
    component: ConversationRoute,
});

function ConversationRoute() {
    const { id } = useParams({ from: "/chat/$id" });
    const { user } = useAuth();
    const { messages, isLoading, mutate } = useMessages(id);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [userScrolled, setUserScrolled] = useState(false);

    const [older, setOlder] = useState<Message[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const orderedMessages = useMemo(
        () => [...older].reverse().concat([...messages].reverse()),
        [older, messages],
    );

    useEffect(() => {
        markConversationRead(id).then(() => {
            mutate();
        });
    }, [id, mutate]);

    useEffect(() => {
        if (!user?.id) {
            return;
        }
        return subscribeMessageStream(user.id, (event) => {
            if (event.type === "unread" || event.type === "reconnected") {
                return;
            }
            if (event.conversationId !== id) {
                return;
            }
            if (event.type === "message") {
                const incoming = normalizeIncomingMessage(event.message);
                mutate(
                    (prev) =>
                        prev?.some((m) => m.id === incoming.id)
                            ? prev
                            : [incoming, ...(prev ?? [])],
                    { revalidate: false },
                );
            } else if (event.type === "recall") {
                mutate(
                    (prev) =>
                        prev?.map((m) =>
                            m.id === event.messageId
                                ? { ...m, recalled: true }
                                : m,
                        ),
                    { revalidate: false },
                );
            }
        });
    }, [user?.id, id, mutate]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: id 作为滚动触发器
    useEffect(() => {
        setUserScrolled(false);
        bottomRef.current?.scrollIntoView();
    }, [id]);

    useEffect(() => {
        if (messages.length > 0 && !userScrolled) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, userScrolled]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) {
            return;
        }
        const container = scrollRef.current;
        const prevHeight = container?.scrollHeight ?? 0;
        setLoadingMore(true);
        try {
            const offset = older.length + messages.length;
            const page = await fetchMessages(
                conversationMessagesPath(id, PAGE_SIZE, offset),
            );
            if (page.length < PAGE_SIZE) {
                setHasMore(false);
            }
            setOlder((prev) => [...prev, ...page]);
            requestAnimationFrame(() => {
                if (container) {
                    container.scrollTop += container.scrollHeight - prevHeight;
                }
            });
        } finally {
            setLoadingMore(false);
        }
    }, [id, loadingMore, hasMore, older.length, messages.length]);

    const handleRecall = useCallback(
        async (message: Message) => {
            try {
                await recallMessage(id, message.id);
                mutate(
                    (prev) =>
                        prev?.map((m) =>
                            m.id === message.id ? { ...m, recalled: true } : m,
                        ),
                    { revalidate: false },
                );
            } catch (error) {
                toast.danger((error as Error).message);
            }
        },
        [id, mutate],
    );

    const handleSend = useCallback(
        async (content: string) => {
            const message = await sendMessage(id, content);
            await mutate((prev) => [message, ...(prev ?? [])], {
                revalidate: false,
            });
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        },
        [id, mutate],
    );

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const isNearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            setUserScrolled(!isNearBottom);
            if (el.scrollTop < 24) {
                loadMore();
            }
        },
        [loadMore],
    );

    if (isLoading) {
        return <LoadingState text="正在加载消息…" />;
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4"
            >
                {hasMore && (
                    <div className="mb-3 flex justify-center">
                        {loadingMore ? (
                            <Spinner size="sm" />
                        ) : (
                            <button
                                type="button"
                                onClick={loadMore}
                                className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors touch-manipulation"
                            >
                                加载更早的消息
                            </button>
                        )}
                    </div>
                )}
                {orderedMessages.length === 0 ? (
                    <EmptyState
                        icon={MessageSquare}
                        title="暂无消息"
                        hint="发送第一条消息开始对话吧"
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        {orderedMessages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.senderId === user?.id}
                                onRecall={handleRecall}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>
            <MessageInput onSend={handleSend} />
        </div>
    );
}

/**
 * 把服务端实时推送的消息归一化为完整 Message 结构。
 * 推送负载为扁平字段（senderName/senderImage），REST 查询返回 sender 对象，兼容两者。
 */
function normalizeIncomingMessage(raw: unknown): Message {
    const data = raw as Partial<Message> & {
        senderName?: string | null;
        senderImage?: string | null;
    };
    const sender: Message["sender"] = data.sender ?? {
        id: data.senderId ?? "unknown",
        name: data.senderName ?? null,
        image: data.senderImage ?? null,
    };
    return {
        id: data.id ?? "",
        content: data.content ?? "",
        senderId: data.senderId ?? sender.id,
        read: data.read ?? false,
        recalled: data.recalled ?? false,
        createdAt: data.createdAt ?? new Date().toISOString(),
        sender,
    };
}
