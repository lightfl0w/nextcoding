import { Input } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "~/components/ui/PageHeader";
import { WorksGrid } from "~/components/WorksGrid";
import { useWorks } from "~/hooks/useWorks";

export const Route = createFileRoute("/search")({
    validateSearch: (search: Record<string, unknown>): { q?: string } => ({
        q: typeof search.q === "string" ? search.q.slice(0, 100) : undefined,
    }),
    component: SearchPage,
});

const SEARCH_PAGE_SIZE = 50;
const PLACEHOLDER_COUNT = 9;

function SearchPage() {
    const { q } = Route.useSearch();
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState(q ?? "");
    const [searchTerm, setSearchTerm] = useState(q ?? "");

    useEffect(() => {
        const timer = setTimeout(() => setSearchTerm(keyword.trim()), 300);
        return () => clearTimeout(timer);
    }, [keyword]);

    useEffect(() => {
        setKeyword(q ?? "");
    }, [q]);

    const updateQuery = (value: string) => {
        navigate({
            to: "/search",
            search: (prev) => ({ ...prev, q: value || undefined }),
            replace: true,
        });
    };

    const {
        data: works,
        isLoading,
        error,
    } = useWorks("latest", SEARCH_PAGE_SIZE, searchTerm || undefined);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <PageHeader
                title="搜索作品"
                description="搜索社区里的编程作品，支持标题、标签与简介"
            />

            <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/60" />
                <Input
                    value={keyword}
                    onChange={(event) => {
                        const value = event.target.value;
                        setKeyword(value);
                        updateQuery(value);
                    }}
                    placeholder="搜索作品标题、标签、简介…"
                    aria-label="搜索作品"
                    className="w-full pl-10 pr-9"
                />
                {keyword && (
                    <button
                        type="button"
                        onClick={() => {
                            setKeyword("");
                            updateQuery("");
                        }}
                        aria-label="清除搜索"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 transition-colors hover:bg-hover hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            <WorksGrid
                works={works}
                isLoading={isLoading}
                error={error}
                placeholderCount={PLACEHOLDER_COUNT}
                emptyText={
                    searchTerm
                        ? "没有找到相关作品，换个关键词试试"
                        : "输入关键词开始搜索作品"
                }
            />
        </div>
    );
}
