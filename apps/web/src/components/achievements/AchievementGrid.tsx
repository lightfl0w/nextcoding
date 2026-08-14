import { Skeleton } from "@heroui/react";
import { Trophy } from "lucide-react";
import { memo } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { Achievement } from "~/lib/api";
import { AchievementBadge } from "./AchievementBadge";

interface AchievementGridProps {
    achievements: (Achievement & {
        unlocked?: boolean;
        unlockedAt?: string;
        progress?: number;
    })[];
    isLoading?: boolean;
    showProgress?: boolean;
}

const GRID_CLASS = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";

const SKELETON_KEYS = Array.from(
    { length: 9 },
    (_, index) => `achievement-skeleton-${index + 1}`,
);

export const AchievementGrid = memo(function AchievementGrid({
    achievements,
    isLoading,
    showProgress,
}: AchievementGridProps) {
    if (isLoading) {
        return (
            <div className={GRID_CLASS}>
                {SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className="h-28 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (achievements.length === 0) {
        return <EmptyState icon={Trophy} title="暂无成就" />;
    }

    return (
        <div className={GRID_CLASS}>
            {achievements.map((item) => (
                <AchievementBadge
                    key={item.id}
                    achievement={item}
                    unlocked={item.unlocked ?? !!item.unlockedAt}
                    progress={item.progress ?? 0}
                    showProgress={showProgress}
                />
            ))}
        </div>
    );
});
