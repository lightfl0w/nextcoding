import { Skeleton } from "@heroui/react";
import { memo } from "react";
import { WorkCard } from "~/components/WorkCard";
import type { Work } from "~/lib/api";

const GRID_CLASS = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";

const SKELETON_KEYS = Array.from(
    { length: 12 },
    (_, index) => `skeleton-${index + 1}`,
);

interface WorksGridProps {
    works: Work[] | undefined;
    isLoading: boolean;
    error: Error | undefined;
    placeholderCount: number;
}

export const WorksGrid = memo(function WorksGrid({
    works,
    isLoading,
    error,
    placeholderCount,
}: WorksGridProps) {
    if (isLoading) {
        return <LoadingGrid count={placeholderCount} />;
    }

    if (error) {
        return (
            <p className="text-sm text-foreground/60">
                作品加载失败，请稍后重试
            </p>
        );
    }

    if (!works?.length) {
        return (
            <p className="text-sm text-foreground/60">
                还没有作品，来发布第一个吧
            </p>
        );
    }

    return (
        <div className={GRID_CLASS}>
            {works.map((work) => (
                <WorkCard key={work.id} work={work} />
            ))}
        </div>
    );
});

function LoadingGrid({ count }: { count: number }) {
    return (
        <div className={GRID_CLASS}>
            {SKELETON_KEYS.slice(0, count).map((key) => (
                <div key={key} className="flex flex-col gap-2">
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
            ))}
        </div>
    );
}
