import { Skeleton } from "@heroui/react";
import { useWorks } from "~/hooks/useWorks";
import { WorkCard } from "./WorkCard";

export function FeaturedWorks() {
    const { data: works, isLoading, error } = useWorks("latest", 6);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map(
                    (key) => (
                        <div key={key} className="flex flex-col gap-2">
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-4 w-2/3 rounded-md" />
                            <Skeleton className="h-3 w-full rounded-md" />
                            <Skeleton className="h-3 w-1/2 rounded-md" />
                        </div>
                    ),
                )}
            </div>
        );
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {works.map((work) => (
                <WorkCard key={work.id} work={work} />
            ))}
        </div>
    );
}
