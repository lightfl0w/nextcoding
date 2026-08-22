import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
    DiscoverSidebar,
    type DiscoverView,
} from "~/components/discover/DiscoverSidebar";
import { NovelsGrid } from "~/components/novels/NovelsGrid";
import { PageHeader } from "~/components/ui/PageHeader";
import { WorksGrid } from "~/components/WorksGrid";
import { useNovels } from "~/hooks/useNovels";
import { useWorks } from "~/hooks/useWorks";
import type { WorkSort } from "~/lib/api";

export const Route = createFileRoute("/discover")({
    component: DiscoverPage,
});

const DISCOVER_PAGE_SIZE = 50;
const PLACEHOLDER_COUNT = 9;

function DiscoverPage() {
    const [view, setView] = useState<DiscoverView>("works");
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

    const { novels: allNovels, isLoading: novelsLoading } = useNovels();
    // 发现页只展示已发布的小说。
    const publishedNovels = useMemo(
        () => allNovels.filter((n) => n.published),
        [allNovels],
    );

    // 小说视图复用侧栏的关键词搜索与排序。
    const filteredNovels = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const matched = term
            ? publishedNovels.filter(
                  (n) =>
                      n.title.toLowerCase().includes(term) ||
                      (n.description ?? "").toLowerCase().includes(term),
              )
            : publishedNovels;
        return [...matched].sort((a, b) => {
            if (sort === "popular") {
                return b.chapterCount - a.chapterCount;
            }
            // latest / weekly（小说暂无周榜数据）按最近更新排序。
            return (
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
        });
    }, [publishedNovels, searchTerm, sort]);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <PageHeader
                title="发现"
                description="浏览社区里大家发布的编程作品与小说，找到感兴趣的灵感"
            />

            {/* 统一布局：内容区 + 常驻侧栏，作品 / 小说视图共用 */}
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                    {view === "works" ? (
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
                    ) : (
                        <NovelsGrid
                            novels={filteredNovels}
                            isLoading={novelsLoading}
                            placeholderCount={PLACEHOLDER_COUNT}
                            emptyText={
                                searchTerm
                                    ? "没有找到相关小说，换个关键词试试"
                                    : "还没有已发布的小说，去「小说」页发布你的第一部作品吧"
                            }
                        />
                    )}
                </div>

                <DiscoverSidebar
                    view={view}
                    onViewChange={setView}
                    sort={sort}
                    onSortChange={setSort}
                    keyword={keyword}
                    onKeywordChange={setKeyword}
                />
            </div>
        </div>
    );
}
