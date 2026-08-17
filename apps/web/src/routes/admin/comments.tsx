import { Card, Input, useOverlayState } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPagination } from "~/components/admin/AdminPagination";
import { CommentsTable } from "~/components/admin/CommentsTable";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminComments } from "~/hooks/useAdmin";
import { type AdminComment, deleteAdminComment } from "~/lib/api/admin";

const PAGE_SIZE = 20;

interface CommentsSearch {
    search?: string;
    page?: number;
}

function parseSearch(search: Record<string, unknown>): CommentsSearch {
    const rawPage = Number(search.page);
    return {
        search:
            typeof search.search === "string"
                ? search.search.slice(0, 64)
                : undefined,
        page:
            Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    };
}

export const Route = createFileRoute("/admin/comments")({
    validateSearch: parseSearch,
    component: CommentsPage,
});

function CommentsPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/admin/comments" });

    const [input, setInput] = useState(search.search ?? "");
    const [deleteTarget, setDeleteTarget] = useState<AdminComment | null>(null);
    const deleteState = useOverlayState();

    const { data, isLoading, mutate } = useAdminComments({
        search: search.search,
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
        await deleteAdminComment(deleteTarget.id);
        await mutate();
    };

    const total = data?.total ?? 0;
    const items = data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="评论管理"
                description="查看社区评论，删除违规内容"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="relative w-full sm:max-w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                        <Input
                            aria-label="搜索评论"
                            className="w-full pl-9"
                            placeholder="搜索评论内容…"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                        />
                    </div>

                    <CommentsTable
                        items={items}
                        isLoading={isLoading}
                        onRequestDelete={(comment) => {
                            setDeleteTarget(comment);
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
                heading="删除评论"
                description={
                    deleteTarget
                        ? `确定删除这条评论吗？其回复与相关通知将一并删除，此操作不可恢复。`
                        : ""
                }
                confirmLabel="删除评论"
                onConfirm={handleDelete}
            />
        </div>
    );
}
