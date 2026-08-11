import { Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Crown, Flame } from "lucide-react";
import { useState } from "react";
import { WorksGrid } from "~/components/WorksGrid";
import { useWorks } from "~/hooks/useWorks";
import type { WorkSort } from "~/lib/api";

export const Route = createFileRoute("/discover")({
    component: DiscoverPage,
});

const DISCOVER_PAGE_SIZE = 50;
const PLACEHOLDER_COUNT = 9;

function DiscoverPage() {
    const [sort, setSort] = useState<WorkSort>("latest");
    const {
        data: works,
        isLoading,
        error,
    } = useWorks(sort, DISCOVER_PAGE_SIZE);

    return (
        <div className="p-8 w-full flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-balance">
                    发现作品
                </h1>
                <p className="text-sm text-foreground/60">
                    浏览社区里大家发布的编程作品，找到感兴趣的灵感
                </p>
            </header>

            <Tabs
                selectedKey={sort}
                onSelectionChange={(key) => setSort(key as WorkSort)}
                className="w-full"
            >
                <Tabs.ListContainer>
                    <Tabs.List aria-label="作品排序">
                        <Tabs.Tab
                            id="weekly"
                            className="flex items-center gap-1.5"
                        >
                            <Crown className="size-4" />
                            本周热榜
                            <Tabs.Indicator />
                        </Tabs.Tab>
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
            </Tabs>

            <div className="pt-6">
                <WorksGrid
                    works={works}
                    isLoading={isLoading}
                    error={error}
                    placeholderCount={PLACEHOLDER_COUNT}
                />
            </div>
        </div>
    );
}
