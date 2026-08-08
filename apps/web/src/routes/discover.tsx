import { Skeleton, Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Flame } from "lucide-react";
import { useState } from "react";
import { WorkCard } from "~/components/WorkCard";
import { useWorks, type Work, type WorkSort } from "~/hooks/useWorks";

export const Route = createFileRoute("/discover")({
    component: RouteComponent,
});

function RouteComponent() {
    const [sort, setSort] = useState<WorkSort>("latest");
    const { data: works, isLoading, error } = useWorks(sort, 50);

    return (
        <div className="p-8 w-full flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">发现作品</h1>
                <p className="text-sm text-foreground/60">
                    浏览社区里大家发布的编程作品，找到感兴趣的灵感
                </p>
            </header>

            <Tabs
                selectedKey={sort}
                onSelectionChange={(key) => setSort(key as WorkSort)}
                variant="secondary"
                className="w-fit"
            >
                <Tabs.ListContainer>
                    <Tabs.List aria-label="作品排序">
                        <Tabs.Tab
                            id="latest"
                            className="flex items-center gap-1.5"
                        >
                            <Clock className="size-4" />
                            最新发布
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab
                            id="popular"
                            className="flex items-center gap-1.5"
                        >
                            <Flame className="size-4" />
                            最受欢迎
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>

                <Tabs.Panel className="pt-6" id={sort}>
                    <WorksGrid
                        works={works}
                        isLoading={isLoading}
                        error={error}
                    />
                </Tabs.Panel>
            </Tabs>
        </div>
    );
}

function WorksGrid({
    works,
    isLoading,
    error,
}: {
    works: Work[] | undefined;
    isLoading: boolean;
    error: Error | undefined;
}) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }, (_, i) => `skeleton-${i}`).map(
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
