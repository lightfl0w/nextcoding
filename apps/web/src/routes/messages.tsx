import { toast } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessagesHeader } from "~/components/messages/MessagesHeader";
import {
    MessagesSidebar,
    MobileTypeFilter,
} from "~/components/messages/MessagesSidebar";
import { NotificationFeed } from "~/components/messages/NotificationFeed";
import { useNotifications } from "~/hooks/useNotifications";
import { markNotificationsRead } from "~/lib/api";
import {
    countNotifications,
    groupNotifications,
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

    const counts = useMemo(
        () => countNotifications(notifications),
        [notifications],
    );

    const filtered = useMemo(() => {
        return notifications.filter((item) => {
            if (readFilter === "unread" && item.read) {
                return false;
            }
            if (typeFilter !== "all" && item.type !== typeFilter) {
                return false;
            }
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
        } catch (error) {
            toast.danger((error as Error).message);
        }
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

                    <NotificationFeed
                        isLoading={isLoading}
                        filtered={filtered}
                        groups={groups}
                        counts={counts}
                        readFilter={readFilter}
                        typeFilter={typeFilter}
                        onReadFilterChange={setReadFilter}
                    />
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
