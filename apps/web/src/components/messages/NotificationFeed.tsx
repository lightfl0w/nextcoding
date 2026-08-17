import { Tabs } from "@heroui/react";
import { LoadingState } from "~/components/ui/LoadingState";
import type { AppNotification } from "~/lib/api";
import type {
    NotificationCounts,
    NotificationFilter,
    NotificationGroup,
    NotificationTypeFilter,
} from "~/lib/notifications";
import { EmptyNotifications } from "./EmptyNotifications";
import { NotificationList } from "./NotificationList";

interface NotificationFeedProps {
    isLoading: boolean;
    filtered: AppNotification[];
    groups: NotificationGroup[];
    counts: NotificationCounts;
    readFilter: NotificationFilter;
    typeFilter: NotificationTypeFilter;
    onReadFilterChange: (filter: NotificationFilter) => void;
    onMarkRead: (id: string) => void;
}

/**
 * 通知列表主区。
 * @param props.isLoading - 是否加载中。
 * @param props.filtered - 过滤后的通知。
 * @param props.groups - 按时间分组的通知。
 * @param props.counts - 各类统计。
 * @param props.readFilter - 已读/未读筛选。
 * @param props.typeFilter - 类型筛选。
 * @param props.onReadFilterChange - 切换已读/未读。
 * @remarks 全部/未读标签页 + 加载、空态、列表三态渲染。
 */
export function NotificationFeed({
    isLoading,
    filtered,
    groups,
    counts,
    readFilter,
    typeFilter,
    onReadFilterChange,
    onMarkRead,
}: NotificationFeedProps) {
    return (
        <Tabs
            selectedKey={readFilter}
            onSelectionChange={(key) =>
                onReadFilterChange(key as NotificationFilter)
            }
            className="w-full"
        >
            <Tabs.ListContainer>
                <Tabs.List aria-label="通知筛选">
                    <Tabs.Tab id="all" className="flex items-center gap-1.5">
                        全部
                        {counts.total > 0 && (
                            <span className="text-xs text-foreground/45 tabular-nums">
                                {counts.total}
                            </span>
                        )}
                        <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="unread" className="flex items-center gap-1.5">
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
                    <LoadingState text="正在加载通知…" />
                ) : filtered.length === 0 ? (
                    <EmptyNotifications
                        readFilter={readFilter}
                        typeFilter={typeFilter}
                    />
                ) : (
                    <NotificationList groups={groups} onMarkRead={onMarkRead} />
                )}
            </Tabs.Panel>
        </Tabs>
    );
}
