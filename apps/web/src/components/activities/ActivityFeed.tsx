import { Skeleton } from "@heroui/react";
import { Inbox } from "lucide-react";
import { memo } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { Activity } from "~/lib/api";
import { ActivityItem } from "./ActivityItem";

interface ActivityFeedProps {
    activities: Activity[];
    isLoading?: boolean;
    emptyText?: string;
}

const SKELETON_KEYS = Array.from(
    { length: 6 },
    (_, index) => `activity-skeleton-${index + 1}`,
);

/**
 * 动态列表。
 * @param props.activities - 动态数据。
 * @param props.isLoading - 是否加载中。
 * @param props.emptyText - 空状态文案。
 */
export const ActivityFeed = memo(function ActivityFeed({
    activities,
    isLoading = false,
    emptyText = "暂无动态",
}: ActivityFeedProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col divide-y divide-default-200/70">
                {SKELETON_KEYS.map((key) => (
                    <div key={key} className="flex gap-3 py-3">
                        <Skeleton className="size-8 rounded-full shrink-0" />
                        <div className="flex flex-col gap-1.5 flex-1">
                            <Skeleton className="h-4 w-3/4 rounded-md" />
                            <Skeleton className="h-3 w-1/3 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!activities.length) {
        return <EmptyState icon={Inbox} title={emptyText} />;
    }

    return (
        <div className="flex flex-col divide-y divide-default-200/70">
            {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
            ))}
        </div>
    );
});
