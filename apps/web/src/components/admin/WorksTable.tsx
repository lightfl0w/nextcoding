import { Chip, Table } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { FileCode2 } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { AdminWork } from "~/lib/api/admin";
import { formatCount, formatDate } from "~/lib/format";
import { AdminTableShell } from "./AdminTableShell";
import { RowActions } from "./RowActions";

interface WorksTableProps {
    items: AdminWork[];
    isLoading: boolean;
    onRequestDelete: (work: AdminWork) => void;
}

/**
 * 作品管理表格：查看作品状态与热度，支持删除。
 */
export function WorksTable({
    items,
    isLoading,
    onRequestDelete,
}: WorksTableProps) {
    return (
        <AdminTableShell
            ariaLabel="作品列表"
            columns={["作品", "作者", "状态", "热度", "更新时间", "操作"]}
            isLoading={isLoading}
            empty={
                <EmptyState
                    icon={FileCode2}
                    title="暂无作品"
                    hint="没有符合条件的作品"
                />
            }
        >
            {items.map((work) => (
                <Table.Row key={work.id}>
                    <Table.Cell>
                        <div className="flex flex-col min-w-0">
                            <Link
                                to="/work/$id"
                                params={{ id: work.id }}
                                className="text-sm font-medium truncate hover:text-accent transition-colors"
                            >
                                {work.title}
                            </Link>
                            <span className="text-xs text-foreground/40 truncate">
                                {work.id}
                            </span>
                        </div>
                    </Table.Cell>
                    <Table.Cell>
                        <span className="text-sm text-foreground/70 truncate">
                            {work.authorName ?? "未命名用户"}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <Chip
                            size="sm"
                            color={
                                work.status === "published"
                                    ? "success"
                                    : "default"
                            }
                            variant="soft"
                        >
                            <Chip.Label>
                                {work.status === "published"
                                    ? "已发布"
                                    : "草稿"}
                            </Chip.Label>
                        </Chip>
                    </Table.Cell>
                    <Table.Cell>
                        <div className="flex items-center gap-3 text-xs text-foreground/55 tabular-nums">
                            <span>赞 {formatCount(work.likes)}</span>
                            <span>火花 {formatCount(work.sparks)}</span>
                            <span>浏览 {formatCount(work.views)}</span>
                        </div>
                    </Table.Cell>
                    <Table.Cell>
                        <span className="text-sm text-foreground/60">
                            {formatDate(work.updatedAt)}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <RowActions
                            label={`管理作品 ${work.title}`}
                            actions={[
                                {
                                    id: "delete",
                                    label: "删除作品",
                                    variant: "danger",
                                },
                            ]}
                            onAction={(key) => {
                                if (key === "delete") {
                                    onRequestDelete(work);
                                }
                            }}
                        />
                    </Table.Cell>
                </Table.Row>
            ))}
        </AdminTableShell>
    );
}
