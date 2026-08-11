import { Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyNotifications } from "~/components/messages/EmptyNotifications";
import { MessagesHeader } from "~/components/messages/MessagesHeader";
import {
    MessagesSidebar,
    MobileTypeFilter,
} from "~/components/messages/MessagesSidebar";
import { NotificationList } from "~/components/messages/NotificationList";
import { NotificationsSkeleton } from "~/components/messages/NotificationsSkeleton";
import { useNotifications } from "~/hooks/useNotifications";
import { markNotificationsRead } from "~/lib/api";
import {
    groupNotifications,
    type NotificationCounts,
    type NotificationFilter,
    type NotificationTypeFilter,
} from "~/lib/notifications";

export const Route = createFileRoute("/messages")({
    component: MessageCenterRoute,
});

function MessageCenterRoute() {
    const { notifications, isLoading, mutate } = useNotifications();
    const [readFilter, setReadFilter] = useState<NotificationFilter>("all");
    const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("all");

    const counts: NotificationCounts = useMemo(() => {
        const total = notifications.length;
        const unread = notifications.filter((item) => !item.read).length;
        const sparkUnread = notifications.filter(
            (item) => !item.read && item.type === "spark",
        ).length;
        const remixUnread = notifications.filter(
            (item) => !item.read && item.type === "remix",
        ).length;
        const spark = notifications.filter(
            (item) => item.type === "spark",
        ).length;
        const remix = notifications.filter(
            (item) => item.type === "remix",
        ).length;
        return { total, unread, spark, remix, sparkUnread, remixUnread };
    }, [notifications]);

    const filtered = useMemo(() => {
        return notifications.filter((item) => {
            if (readFilter === "unread" && item.read) return false;
            if (typeFilter !== "all" && item.type !== typeFilter) return false;
            return true;
        });
    }, [notifications, readFilter, typeFilter]);

    const groups = useMemo(() => groupNotifications(filtered), [filtered]);

    const markAllRead = async () => {
        try {
            await markNotificationsRead();
            mutate(
                (current = []) =>
                    current.map((item) => ({ ...item, read: true })),
                false,
            );
        } catch {}
    };

    return (
        <div className="w-full mx-auto px-4 md:px-8 py-6 md:py-8">
            <div className="flex flex-col gap-6 md:grid md:gap-8 md:grid-cols-[minmax(0,1fr)_220px]">
                <main className="flex min-w-0 flex-col gap-6 order-2 md:order-1">
                    <MessagesHeader
                        unreadCount={counts.unread}
                        onMarkAllRead={markAllRead}
                    />

                    <div className="md:hidden">
                        <MobileTypeFilter
                            typeFilter={typeFilter}
                            onTypeFilterChange={setTypeFilter}
                            counts={counts}
                        />
                    </div>

                    <Tabs
                        selectedKey={readFilter}
                        onSelectionChange={(key) =>
                            setReadFilter(key as NotificationFilter)
                        }
                        className="w-full"
                    >
                        <Tabs.ListContainer>
                            <Tabs.List aria-label="通知筛选">
                                <Tabs.Tab
                                    id="all"
                                    className="flex items-center gap-1.5"
                                >
                                    全部
                                    {counts.total > 0 && (
                                        <span className="text-xs text-foreground/45 tabular-nums">
                                            {counts.total}
                                        </span>
                                    )}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                                <Tabs.Tab
                                    id="unread"
                                    className="flex items-center gap-1.5"
                                >
                                    未读
                                    {counts.unread > 0 && (
                                        <span className="min-w-4 h-4 px-1 rounded-full bg-danger text-background text-[10px] font-semibold flex items-center justify-center tabular-nums">
                                            {counts.unread}
                                        </span>
                                    )}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                            </Tabs.List>
                        </Tabs.ListContainer>

                        <Tabs.Panel className="pt-2" id={readFilter}>
                            {isLoading ? (
                                <NotificationsSkeleton />
                            ) : filtered.length === 0 ? (
                                <EmptyNotifications
                                    readFilter={readFilter}
                                    typeFilter={typeFilter}
                                />
                            ) : (
                                <NotificationList groups={groups} />
                            )}
                        </Tabs.Panel>
                    </Tabs>
                </main>

                <div className="order-1 md:order-2">
                    <MessagesSidebar
                        counts={counts}
                        typeFilter={typeFilter}
                        onTypeFilterChange={setTypeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
