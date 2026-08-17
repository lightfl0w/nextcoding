import { Button, Card, Input, useOverlayState } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminChatList } from "~/components/admin/AdminChatList";
import { AdminChatView } from "~/components/admin/AdminChatView";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { PageHeader } from "~/components/ui/PageHeader";
import {
    useAdminConversationMessages,
    useAdminConversations,
} from "~/hooks/useAdmin";
import {
    type AdminConversation,
    type AdminMessage,
    deleteAdminConversation,
    deleteAdminMessage,
} from "~/lib/api/admin";

const PAGE_SIZE = 20;

interface MessagesSearch {
    conversation?: string;
    search?: string;
    page?: number;
}

function parseSearch(search: Record<string, unknown>): MessagesSearch {
    const rawPage = Number(search.page);
    return {
        conversation:
            typeof search.conversation === "string"
                ? search.conversation
                : undefined,
        search:
            typeof search.search === "string"
                ? search.search.slice(0, 64)
                : undefined,
        page:
            Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    };
}

export const Route = createFileRoute("/admin/messages")({
    validateSearch: parseSearch,
    component: AdminMessagesPage,
});

function AdminMessagesPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/admin/messages" });

    const [input, setInput] = useState(search.search ?? "");
    const [messageTarget, setMessageTarget] = useState<AdminMessage | null>(
        null,
    );
    const [conversationTarget, setConversationTarget] =
        useState<AdminConversation | null>(null);
    const messageDeleteState = useOverlayState();
    const conversationDeleteState = useOverlayState();

    const {
        data,
        isLoading,
        mutate: mutateConversations,
    } = useAdminConversations({
        search: search.search,
        page: search.page,
        pageSize: PAGE_SIZE,
    });
    const {
        data: messagesData,
        isLoading: messagesLoading,
        mutate: mutateMessages,
    } = useAdminConversationMessages(search.conversation);

    const selectedConversation = useMemo(
        () => data?.items.find((item) => item.id === search.conversation),
        [data, search.conversation],
    );

    useEffect(() => {
        setInput(search.search ?? "");
    }, [search.search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const next = input.trim().slice(0, 64) || undefined;
            if (next === search.search) {
                return;
            }
            navigate({
                search: (prev) => ({
                    ...prev,
                    search: next,
                    page: undefined,
                }),
                replace: true,
            });
        }, 400);
        return () => clearTimeout(timer);
    }, [input, navigate, search.search]);

    const openConversation = (id: string) => {
        navigate({ search: (prev) => ({ ...prev, conversation: id }) });
    };

    const backToList = () => {
        navigate({
            search: (prev) => ({
                conversation: undefined,
                search: prev.search,
            }),
        });
    };

    const handleDeleteMessage = async () => {
        if (!messageTarget) {
            return;
        }
        await deleteAdminMessage(messageTarget.id);
        await Promise.all([mutateMessages(), mutateConversations()]);
    };

    const handleDeleteConversation = async () => {
        if (!conversationTarget) {
            return;
        }
        await deleteAdminConversation(conversationTarget.id);
        if (search.conversation === conversationTarget.id) {
            backToList();
        }
        await mutateConversations();
    };

    const total = data?.total ?? 0;
    const page = search.page ?? 1;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const messages = messagesData?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="聊天管理"
                description="查看私信会话与聊天记录，删除违规内容"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70 overflow-hidden">
                <div className="flex h-[70vh] min-h-[440px] md:h-[calc(100dvh-13rem)]">
                    <div
                        className={`${
                            search.conversation ? "hidden md:flex" : "flex"
                        } flex-col w-full md:w-80 shrink-0 border-r border-default-100`}
                    >
                        <div className="p-3 border-b border-default-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                                <Input
                                    aria-label="搜索会话"
                                    className="w-full pl-9"
                                    placeholder="搜索用户或消息…"
                                    value={input}
                                    onChange={(event) =>
                                        setInput(event.target.value)
                                    }
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <AdminChatList
                                conversations={data?.items ?? []}
                                activeId={search.conversation}
                                isLoading={isLoading}
                                onSelect={openConversation}
                                onRequestDelete={(conversation) => {
                                    setConversationTarget(conversation);
                                    conversationDeleteState.open();
                                }}
                            />
                        </div>
                        <div className="p-3 border-t border-default-100">
                            <CompactPager
                                page={page}
                                totalPages={totalPages}
                                total={total}
                                onPageChange={(nextPage) =>
                                    navigate({
                                        search: (prev) => ({
                                            ...prev,
                                            page: nextPage,
                                        }),
                                        replace: true,
                                    })
                                }
                            />
                        </div>
                    </div>

                    <div
                        className={`${
                            search.conversation ? "flex" : "hidden md:flex"
                        } flex-1 min-w-0 flex-col`}
                    >
                        <AdminChatView
                            conversation={selectedConversation}
                            messages={messages}
                            isLoading={messagesLoading}
                            onBack={backToList}
                            onRequestDeleteMessage={(message) => {
                                setMessageTarget(message);
                                messageDeleteState.open();
                            }}
                            onRequestDeleteConversation={(conversation) => {
                                setConversationTarget(conversation);
                                conversationDeleteState.open();
                            }}
                        />
                    </div>
                </div>
            </Card>

            <ConfirmDialog
                state={messageDeleteState}
                heading="删除消息"
                description={
                    messageTarget
                        ? `确定删除这条消息吗？内容：${messageTarget.content.slice(0, 60)}${messageTarget.content.length > 60 ? "…" : ""}`
                        : ""
                }
                confirmLabel="删除消息"
                onConfirm={handleDeleteMessage}
            />
            <ConfirmDialog
                state={conversationDeleteState}
                heading="删除会话"
                description={
                    conversationTarget
                        ? `确定删除「${conversationTarget.user1.name ?? "未命名用户"} 与 ${conversationTarget.user2.name ?? "未命名用户"}」的全部 ${conversationTarget.messageCount} 条私信吗？此操作不可恢复。`
                        : ""
                }
                confirmLabel="删除会话"
                onConfirm={handleDeleteConversation}
            />
        </div>
    );
}

function CompactPager({
    page,
    totalPages,
    total,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground/45 tabular-nums">
                共 {total.toLocaleString()} 条
            </span>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="上一页"
                    isDisabled={page <= 1}
                    onPress={() => onPageChange(page - 1)}
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-foreground/50 tabular-nums">
                    第 {page}/{totalPages} 页
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="下一页"
                    isDisabled={page >= totalPages}
                    onPress={() => onPageChange(page + 1)}
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
