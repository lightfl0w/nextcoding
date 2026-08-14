import { Button, Dropdown, Label, Table } from "@heroui/react";
import { MoreHorizontal, Tags } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { AdminTag } from "~/lib/api/admin";
import { formatDate } from "~/lib/format";
import { AdminTableShell } from "./AdminTableShell";

interface TagsTableProps {
    items: AdminTag[];
    isLoading: boolean;
    onRequestDelete: (tag: AdminTag) => void;
}

/**
 * 标签管理表格：展示标签热度，支持删除。
 */
export function TagsTable({
    items,
    isLoading,
    onRequestDelete,
}: TagsTableProps) {
    return (
        <AdminTableShell
            ariaLabel="标签列表"
            columns={["标签", "标识", "作品数", "创建时间", "操作"]}
            isLoading={isLoading}
            empty={
                <EmptyState
                    icon={Tags}
                    title="暂无标签"
                    hint="还没有任何标签"
                />
            }
        >
            {items.map((tag) => (
                <Table.Row key={tag.id}>
                    <Table.Cell>
                        <span className="text-sm font-medium text-foreground">
                            {tag.name}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <span className="text-sm text-foreground/50 font-mono">
                            #{tag.slug}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <span className="text-sm tabular-nums">
                            {tag.workCount.toLocaleString()}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <span className="text-sm text-foreground/60">
                            {formatDate(tag.createdAt)}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <Dropdown>
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`管理标签 ${tag.name}`}
                                isIconOnly
                            >
                                <MoreHorizontal className="size-4" />
                            </Button>
                            <Dropdown.Popover>
                                <Dropdown.Menu
                                    onAction={(key) => {
                                        if (key === "delete") {
                                            onRequestDelete(tag);
                                        }
                                    }}
                                >
                                    <Dropdown.Item
                                        id="delete"
                                        textValue="删除标签"
                                        variant="danger"
                                    >
                                        <Label>删除标签</Label>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    </Table.Cell>
                </Table.Row>
            ))}
        </AdminTableShell>
    );
}
