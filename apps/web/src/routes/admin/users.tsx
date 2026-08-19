import { Card, Input, toast, useOverlayState } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPagination } from "~/components/admin/AdminPagination";
import { BanModal } from "~/components/admin/BanModal";
import { FilterTabs } from "~/components/admin/FilterTabs";
import { UsersTable } from "~/components/admin/UsersTable";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminUsers } from "~/hooks/useAdmin";
import { useAuth } from "~/hooks/useAuth";
import {
    type AdminUser,
    banAdminUser,
    deleteAdminUser,
    setAdminUserRole,
    unbanAdminUser,
} from "~/lib/api/admin";

const PAGE_SIZE = 20;

interface UsersSearch {
    search?: string;
    role?: "admin" | "user";
    banned?: boolean;
    page?: number;
}

function parseSearch(search: Record<string, unknown>): UsersSearch {
    const rawPage = Number(search.page);
    return {
        search:
            typeof search.search === "string"
                ? search.search.slice(0, 64)
                : undefined,
        role:
            search.role === "admin" || search.role === "user"
                ? search.role
                : undefined,
        banned:
            search.banned === "true"
                ? true
                : search.banned === "false"
                  ? false
                  : undefined,
        page:
            Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    };
}

export const Route = createFileRoute("/admin/users")({
    validateSearch: parseSearch,
    component: UsersPage,
});

function UsersPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/admin/users" });
    const { user: currentUser } = useAuth();

    const [input, setInput] = useState(search.search ?? "");
    const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
    const banState = useOverlayState();
    const deleteState = useOverlayState();

    const { data, isLoading, mutate } = useAdminUsers({
        search: search.search,
        role: search.role,
        banned: search.banned,
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

    const updateFilter = (patch: Partial<UsersSearch>) => {
        navigate({
            search: (prev) => ({ ...prev, ...patch, page: undefined }),
            replace: true,
        });
    };

    const handleSetRole = async (user: AdminUser, role: "admin" | "user") => {
        try {
            await setAdminUserRole(user.id, role);
            toast.success(role === "admin" ? "已设为管理员" : "已设为普通用户");
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "修改角色失败");
        }
    };

    const handleBan = async (reason: string, hours?: number) => {
        if (!banTarget) {
            return;
        }
        await banAdminUser(banTarget.id, reason, hours);
        await mutate();
    };

    const handleUnban = async (user: AdminUser) => {
        try {
            await unbanAdminUser(user.id);
            toast.success("已解封该用户");
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "解封失败");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) {
            return;
        }
        await deleteAdminUser(deleteTarget.id);
        await mutate();
    };

    const requestBan = (user: AdminUser) => {
        setBanTarget(user);
        banState.open();
    };

    const requestDelete = (user: AdminUser) => {
        setDeleteTarget(user);
        deleteState.open();
    };

    const total = data?.total ?? 0;
    const items = data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="用户管理"
                description="管理用户角色、封禁状态，或删除违规账号"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                            <Input
                                aria-label="搜索用户"
                                className="w-full pl-9"
                                placeholder="搜索昵称或邮箱…"
                                value={input}
                                onChange={(event) =>
                                    setInput(event.target.value)
                                }
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <FilterTabs
                                label="按角色筛选"
                                value={search.role ?? "all"}
                                options={[
                                    { value: "all", label: "全部" },
                                    { value: "admin", label: "管理" },
                                    { value: "user", label: "用户" },
                                ]}
                                onChange={(role) =>
                                    updateFilter({
                                        role:
                                            role === "all"
                                                ? undefined
                                                : (role as "admin" | "user"),
                                    })
                                }
                            />
                            <FilterTabs
                                label="按封禁状态筛选"
                                value={
                                    search.banned === undefined
                                        ? "all"
                                        : search.banned
                                          ? "banned"
                                          : "normal"
                                }
                                options={[
                                    { value: "all", label: "全部" },
                                    { value: "normal", label: "正常" },
                                    { value: "banned", label: "封禁" },
                                ]}
                                onChange={(banned) =>
                                    updateFilter({
                                        banned:
                                            banned === "all"
                                                ? undefined
                                                : banned === "banned",
                                    })
                                }
                            />
                        </div>
                    </div>

                    <UsersTable
                        items={items}
                        isLoading={isLoading}
                        currentUserId={currentUser?.id ?? ""}
                        onSetRole={handleSetRole}
                        onRequestBan={requestBan}
                        onRequestUnban={handleUnban}
                        onRequestDelete={requestDelete}
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

            <BanModal state={banState} user={banTarget} onConfirm={handleBan} />
            <ConfirmDialog
                state={deleteState}
                heading="删除用户"
                description={
                    deleteTarget
                        ? `确定删除用户「${deleteTarget.name ?? "未命名用户"}」吗？该用户的全部作品、评论与社交数据将一并删除，此操作不可恢复。`
                        : ""
                }
                confirmLabel="删除用户"
                onConfirm={handleDelete}
            />
        </div>
    );
}
