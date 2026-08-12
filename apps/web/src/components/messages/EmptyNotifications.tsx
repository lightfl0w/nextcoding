import { Button } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";
import type {
    NotificationFilter,
    NotificationTypeFilter,
} from "~/lib/notifications";

export function EmptyNotifications({
    readFilter,
    typeFilter,
}: {
    readFilter: NotificationFilter;
    typeFilter: NotificationTypeFilter;
}) {
    const isUnread = readFilter === "unread";
    const typeLabel =
        typeFilter === "spark"
            ? "火花"
            : typeFilter === "remix"
              ? "二创"
              : typeFilter === "comment"
                ? "评论"
                : "";

    const title = isUnread
        ? "没有未读通知"
        : typeFilter !== "all"
          ? `还没有${typeLabel}通知`
          : "还没有通知";
    const hint = isUnread
        ? "已读通知会自动归档到这里"
        : typeFilter !== "all"
          ? "试试切换到其他分类，或者去发现页看看"
          : "快去发现页逛逛，给喜欢的作品送火花吧";

    return (
        <EmptyState
            icon={Bell}
            title={title}
            hint={hint}
            action={
                !isUnread && typeFilter === "all" ? (
                    <Link to="/discover">
                        <Button size="sm" variant="ghost">
                            去发现好作品
                        </Button>
                    </Link>
                ) : undefined
            }
        />
    );
}
