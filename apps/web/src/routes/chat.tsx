import {
    createFileRoute,
    Outlet,
    useRouterState,
} from "@tanstack/react-router";
import { ConversationList } from "~/components/messages/ConversationList";
import { PageHeader } from "~/components/ui/PageHeader";
import { useConversations } from "~/hooks/useConversations";

export const Route = createFileRoute("/chat")({
    component: ChatLayout,
});

function ChatLayout() {
    const pathname = useRouterState({
        select: (s) => s.location.pathname,
    });
    const activeId = pathname.startsWith("/chat/")
        ? pathname.slice("/chat/".length)
        : undefined;
    const listOnly = !activeId;

    const { conversations, isLoading } = useConversations();

    return (
        <div className="flex h-dvh overflow-hidden">
            <aside
                className={`${
                    listOnly ? "flex w-full md:w-80" : "hidden md:flex w-80"
                } shrink-0 flex-col  bg-surface-secondary`}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <div className="px-5 pt-5 pb-3 shrink-0">
                        <PageHeader
                            title="聊天"
                            description="与社区用户互发私信"
                        />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
                        <ConversationList
                            conversations={conversations}
                            isLoading={isLoading}
                            activeId={activeId}
                        />
                    </div>
                </div>
            </aside>
            <main
                className={`${
                    listOnly ? "hidden md:flex" : "flex"
                } min-w-0 flex-1 flex-col`}
            >
                <Outlet />
            </main>
        </div>
    );
}
