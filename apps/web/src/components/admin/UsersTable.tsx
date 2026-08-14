import { Avatar, Button, Chip, Dropdown, Label, Table } from "@heroui/react";
import { MoreHorizontal, Users } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { AdminUser } from "~/lib/api/admin";
import { formatDate } from "~/lib/format";
import { AdminTableShell } from "./AdminTableShell";

interface UsersTableProps {
    items: AdminUser[];
    isLoading: boolean;
    currentUserId: string;
    onSetRole: (user: AdminUser, role: "admin" | "user") => void;
    onRequestBan: (user: AdminUser) => void;
    onRequestUnban: (user: AdminUser) => void;
    onRequestDelete: (user: AdminUser) => void;
}

/**
 * 用户管理表格：角色调整、封禁/解封、删除。
 */
export function UsersTable({
    items,
    isLoading,
    currentUserId,
    onSetRole,
    onRequestBan,
    onRequestUnban,
    onRequestDelete,
}: UsersTableProps) {
    return (
        <AdminTableShell
            ariaLabel="用户列表"
            columns={["用户", "角色", "状态", "作品", "注册时间", "操作"]}
            isLoading={isLoading}
            empty={
                <EmptyState
                    icon={Users}
                    title="暂无用户"
                    hint="没有符合条件的用户"
                />
            }
        >
            {items.map((user) => (
                <TableRow
                    key={user.id}
                    user={user}
                    isCurrentUser={user.id === currentUserId}
                    onSetRole={onSetRole}
                    onRequestBan={onRequestBan}
                    onRequestUnban={onRequestUnban}
                    onRequestDelete={onRequestDelete}
                />
            ))}
        </AdminTableShell>
    );
}

function TableRow({
    user,
    isCurrentUser,
    onSetRole,
    onRequestBan,
    onRequestUnban,
    onRequestDelete,
}: {
    user: AdminUser;
    isCurrentUser: boolean;
    onSetRole: (user: AdminUser, role: "admin" | "user") => void;
    onRequestBan: (user: AdminUser) => void;
    onRequestUnban: (user: AdminUser) => void;
    onRequestDelete: (user: AdminUser) => void;
}) {
    const roleLabel = user.role === "admin" ? "管理员" : "用户";

    return (
        <Table.Row>
            <Table.Cell>
                <div className="flex items-center gap-3 min-w-0">
                    <Avatar size="sm" className="shrink-0">
                        {user.image ? (
                            <Avatar.Image
                                alt={user.name ?? "用户"}
                                src={user.image}
                            />
                        ) : null}
                        <Avatar.Fallback>
                            {(user.name ?? "用").trim().charAt(0).toUpperCase()}
                        </Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                            {user.name ?? "未命名用户"}
                            {isCurrentUser ? "（我）" : ""}
                        </span>
                        <span className="text-xs text-foreground/45 truncate">
                            {user.email}
                        </span>
                    </div>
                </div>
            </Table.Cell>
            <Table.Cell>
                <Chip
                    size="sm"
                    variant={user.role === "admin" ? "primary" : "soft"}
                >
                    <Chip.Label>{roleLabel}</Chip.Label>
                </Chip>
            </Table.Cell>
            <Table.Cell>
                {user.banned ? (
                    <Chip size="sm" color="danger" variant="soft">
                        <Chip.Label>已封禁</Chip.Label>
                    </Chip>
                ) : (
                    <Chip size="sm" color="success" variant="soft">
                        <Chip.Label>正常</Chip.Label>
                    </Chip>
                )}
            </Table.Cell>
            <Table.Cell>
                <span className="text-sm tabular-nums">
                    {user.workCount.toLocaleString()}
                </span>
            </Table.Cell>
            <Table.Cell>
                <span className="text-sm text-foreground/60">
                    {formatDate(user.createdAt)}
                </span>
            </Table.Cell>
            <Table.Cell>
                <Dropdown>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`管理用户 ${user.name ?? user.email}`}
                        isIconOnly
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            onAction={(key) => {
                                if (key === "role-admin") {
                                    onSetRole(user, "admin");
                                } else if (key === "role-user") {
                                    onSetRole(user, "user");
                                } else if (key === "ban") {
                                    onRequestBan(user);
                                } else if (key === "unban") {
                                    onRequestUnban(user);
                                } else if (key === "delete") {
                                    onRequestDelete(user);
                                }
                            }}
                        >
                            <Dropdown.Item
                                id="role-admin"
                                textValue="设为管理员"
                                isDisabled={
                                    user.role === "admin" || isCurrentUser
                                }
                            >
                                <Label>设为管理员</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="role-user"
                                textValue="设为普通用户"
                                isDisabled={
                                    user.role !== "admin" || isCurrentUser
                                }
                            >
                                <Label>设为普通用户</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="ban"
                                textValue="封禁用户"
                                isDisabled={user.banned || isCurrentUser}
                            >
                                <Label>封禁用户</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="unban"
                                textValue="解封用户"
                                isDisabled={!user.banned}
                            >
                                <Label>解封用户</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="delete"
                                textValue="删除用户"
                                variant="danger"
                                isDisabled={isCurrentUser}
                            >
                                <Label>删除用户</Label>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>
            </Table.Cell>
        </Table.Row>
    );
}
