import { Input, Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Crown, Flame, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "~/components/ui/PageHeader";
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
    const [keyword, setKeyword] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setSearchTerm(keyword.trim()), 300);
        return () => clearTimeout(timer);
    }, [keyword]);

    const {
        data: works,
        isLoading,
        error,
    } = useWorks(sort, DISCOVER_PAGE_SIZE, searchTerm || undefined);

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-6">
            <PageHeader
                title="发现作品"
                description="浏览社区里大家发布的编程作品，找到感兴趣的灵感"
            />

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索作品标题、标签、简介…"
                    aria-label="搜索作品"
                    className="w-full pl-10 pr-9"
                />
                {keyword && (
                    <button
                        type="button"
                        onClick={() => setKeyword("")}
                        aria-label="清除搜索"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-hover text-foreground/40 hover:text-foreground transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

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

            <div className="pt-2">
                <WorksGrid
                    works={works}
                    isLoading={isLoading}
                    error={error}
                    placeholderCount={PLACEHOLDER_COUNT}
                    emptyText={
                        searchTerm
                            ? "没有找到相关作品，换个关键词试试"
                            : undefined
                    }
                />
            </div>
        </div>
    );
}
