import { Card, Input, useOverlayState } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPagination } from "~/components/admin/AdminPagination";
import { FilterTabs } from "~/components/admin/FilterTabs";
import { WorksTable } from "~/components/admin/WorksTable";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminWorks } from "~/hooks/useAdmin";
import { type AdminWork, deleteAdminWork } from "~/lib/api/admin";

const PAGE_SIZE = 20;

interface WorksSearch {
    search?: string;
    status?: "draft" | "published";
    page?: number;
}

function parseSearch(search: Record<string, unknown>): WorksSearch {
    const rawPage = Number(search.page);
    return {
        search:
            typeof search.search === "string"
                ? search.search.slice(0, 64)
                : undefined,
        status:
            search.status === "draft" || search.status === "published"
                ? search.status
                : undefined,
        page:
            Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    };
}

export const Route = createFileRoute("/admin/works")({
    validateSearch: parseSearch,
    component: WorksPage,
});

function WorksPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/admin/works" });

    const [input, setInput] = useState(search.search ?? "");
    const [deleteTarget, setDeleteTarget] = useState<AdminWork | null>(null);
    const deleteState = useOverlayState();

    const { data, isLoading, mutate } = useAdminWorks({
        search: search.search,
        status: search.status,
        page: search.page,
        pageSize: PAGE_SIZE,
    });

    useEffect(() => {
        setInput(search.search ?? "");
    }, [search.search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const next = input.trim().slice(0, 64) || undefined;
            if (next === search.search) {
                return;
            }
            navigate({
                search: (prev) => ({ ...prev, search: next, page: undefined }),
                replace: true,
            });
        }, 400);
        return () => clearTimeout(timer);
    }, [input, navigate, search.search]);

    const handleDelete = async () => {
        if (!deleteTarget) {
            return;
        }
        await deleteAdminWork(deleteTarget.id);
        await mutate();
    };

    const total = data?.total ?? 0;
    const items = data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="作品管理"
                description="查看全部作品，处理违规内容"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                            <Input
                                aria-label="搜索作品"
                                className="w-full pl-9"
                                placeholder="搜索作品标题…"
                                value={input}
                                onChange={(event) =>
                                    setInput(event.target.value)
                                }
                            />
                        </div>
                        <FilterTabs
                            label="按状态筛选"
                            value={search.status ?? "all"}
                            options={[
                                { value: "all", label: "全部" },
                                { value: "published", label: "已发布" },
                                { value: "draft", label: "草稿" },
                            ]}
                            onChange={(status) =>
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        status:
                                            status === "all"
                                                ? undefined
                                                : status,
                                        page: undefined,
                                    }),
                                    replace: true,
                                })
                            }
                        />
                    </div>

                    <WorksTable
                        items={items}
                        isLoading={isLoading}
                        onRequestDelete={(work) => {
                            setDeleteTarget(work);
                            deleteState.open();
                        }}
                    />

                    <AdminPagination
                        page={search.page ?? 1}
                        pageSize={PAGE_SIZE}
                        total={total}
                        onPageChange={(page) =>
                            navigate({
                                search: (prev) => ({ ...prev, page }),
                                replace: true,
                            })
                        }
                    />
                </Card.Content>
            </Card>

            <ConfirmDialog
                state={deleteState}
                heading="删除作品"
                description={
                    deleteTarget
                        ? `确定删除作品「${deleteTarget.title}」吗？其文件、版本、评论与热度数据将一并删除，此操作不可恢复。`
                        : ""
                }
                confirmLabel="删除作品"
                onConfirm={handleDelete}
            />
        </div>
    );
}
