import {
    Avatar,
    Button,
    Card,
    Chip,
    Dropdown,
    Input,
    Label,
    Table,
    toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Plus, Search, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminTableShell } from "~/components/admin/AdminTableShell";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import {
    useAdminAchievements,
    useAdminUserAchievements,
    useAdminUsers,
} from "~/hooks/useAdmin";
import {
    type AdminAchievement,
    type AdminUser,
    grantAdminAchievement,
    revokeAdminAchievement,
} from "~/lib/api/admin";

export const Route = createFileRoute("/admin/achievements")({
    component: AchievementsPage,
});

function AchievementsPage() {
    const { data: achievements, isLoading: catalogLoading } =
        useAdminAchievements();

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="成就管理"
                description="查看成就目录，手动授予或撤销用户成就"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-foreground/80">
                        成就目录
                    </h2>
                    <AdminTableShell
                        ariaLabel="成就目录"
                        columns={["成就", "分类", "条件", "解锁人数", "说明"]}
                        isLoading={catalogLoading}
                        empty={
                            <EmptyState
                                icon={Trophy}
                                title="暂无成就"
                                hint="成就系统尚未配置"
                            />
                        }
                    >
                        {(achievements ?? []).map((item) => (
                            <Table.Row key={item.id}>
                                <Table.Cell>
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-8 rounded-lg bg-warning/15 text-warning flex items-center justify-center shrink-0">
                                            <Award className="size-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium truncate">
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-foreground/40 font-mono">
                                                {item.key}
                                            </span>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/60">
                                        {item.category ?? "—"}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/60 tabular-nums">
                                        {item.threshold ?? "—"}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm tabular-nums">
                                        {item.unlockCount.toLocaleString()} 人
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <p className="text-sm text-foreground/60 line-clamp-2 max-w-[300px]">
                                        {item.description}
                                    </p>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </AdminTableShell>
                </Card.Content>
            </Card>

            <UserAchievementCard achievements={achievements ?? []} />
        </div>
    );
}

function UserAchievementCard({
    achievements,
}: {
    achievements: AdminAchievement[];
}) {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    const { data: userResult } = useAdminUsers({
        search: search || undefined,
        pageSize: 5,
        page: 1,
    });
    const {
        data: granted,
        isLoading,
        mutate,
    } = useAdminUserAchievements(selectedUser?.id);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const grantedIds = useMemo(
        () => new Set((granted ?? []).map((item) => item.id)),
        [granted],
    );
    const grantable = achievements.filter((item) => !grantedIds.has(item.id));

    const handleGrant = async (achievementId: string) => {
        if (!selectedUser) {
            return;
        }
        try {
            await grantAdminAchievement(selectedUser.id, achievementId);
            toast.success("已授予成就");
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "授予失败");
        }
    };

    const handleRevoke = async (achievementId: string) => {
        if (!selectedUser) {
            return;
        }
        try {
            await revokeAdminAchievement(selectedUser.id, achievementId);
            toast.success("已撤销成就");
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "撤销失败");
        }
    };

    return (
        <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
            <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-foreground/80">
                    用户成就授予
                </h2>

                <div className="relative w-full sm:max-w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                    <Input
                        aria-label="搜索用户"
                        className="w-full pl-9"
                        placeholder="搜索昵称或邮箱…"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                    />
                </div>

                {search && !selectedUser && (
                    <div className="flex flex-col gap-1">
                        {(userResult?.items ?? []).map((user) => (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => {
                                    setSelectedUser(user);
                                    setSearchInput("");
                                    setSearch("");
                                }}
                                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-hover transition-colors text-left"
                            >
                                <Avatar size="sm" className="shrink-0">
                                    {user.image ? (
                                        <Avatar.Image
                                            alt={user.name ?? "用户"}
                                            src={user.image}
                                        />
                                    ) : null}
                                    <Avatar.Fallback>
                                        {(user.name ?? "用")
                                            .trim()
                                            .charAt(0)
                                            .toUpperCase()}
                                    </Avatar.Fallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {user.name ?? "未命名用户"}
                                    </p>
                                    <p className="text-xs text-foreground/45 truncate">
                                        {user.email}
                                    </p>
                                </div>
                            </button>
                        ))}
                        {(userResult?.items ?? []).length === 0 && (
                            <p className="text-sm text-foreground/40 py-3 text-center">
                                没有匹配的用户
                            </p>
                        )}
                    </div>
                )}

                {selectedUser && (
                    <div className="flex flex-col gap-4 border-t border-default-100 pt-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <Avatar size="sm" className="shrink-0">
                                {selectedUser.image ? (
                                    <Avatar.Image
                                        alt={selectedUser.name ?? "用户"}
                                        src={selectedUser.image}
                                    />
                                ) : null}
                                <Avatar.Fallback>
                                    {(selectedUser.name ?? "用")
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase()}
                                </Avatar.Fallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">
                                    {selectedUser.name ?? "未命名用户"}
                                </p>
                                <p className="text-xs text-foreground/45 truncate">
                                    {selectedUser.email}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onPress={() => setSelectedUser(null)}
                            >
                                更换用户
                            </Button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-foreground/50">
                                已获得成就
                            </p>
                            {isLoading ? (
                                <p className="text-sm text-foreground/40">
                                    正在加载…
                                </p>
                            ) : (granted ?? []).length === 0 ? (
                                <p className="text-sm text-foreground/40">
                                    该用户暂无成就
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {(granted ?? []).map((item) => (
                                        <Chip
                                            key={item.id}
                                            size="sm"
                                            variant="soft"
                                        >
                                            <Chip.Label>{item.name}</Chip.Label>
                                            <button
                                                type="button"
                                                aria-label={`撤销成就 ${item.name}`}
                                                className="ml-1 text-foreground/50 hover:text-danger"
                                                onClick={() =>
                                                    handleRevoke(item.id)
                                                }
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </Chip>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-foreground/50">
                                授予成就
                            </p>
                            {grantable.length === 0 ? (
                                <p className="text-sm text-foreground/40">
                                    全部成就已授予
                                </p>
                            ) : (
                                <Dropdown>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="gap-1.5 w-fit"
                                    >
                                        <Plus className="size-3.5" />
                                        选择成就
                                    </Button>
                                    <Dropdown.Popover>
                                        <Dropdown.Menu
                                            onAction={(key) =>
                                                handleGrant(String(key))
                                            }
                                        >
                                            {grantable.map((item) => (
                                                <Dropdown.Item
                                                    key={item.id}
                                                    id={item.id}
                                                    textValue={item.name}
                                                >
                                                    <Label>{item.name}</Label>
                                                </Dropdown.Item>
                                            ))}
                                        </Dropdown.Menu>
                                    </Dropdown.Popover>
                                </Dropdown>
                            )}
                        </div>
                    </div>
                )}
            </Card.Content>
        </Card>
    );
}
