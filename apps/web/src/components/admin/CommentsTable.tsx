import { Avatar, Table } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { MessageSquareQuote } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { AdminComment } from "~/lib/api/admin";
import { formatDate } from "~/lib/format";
import { AdminTableShell } from "./AdminTableShell";
import { RowActions } from "./RowActions";

interface CommentsTableProps {
    items: AdminComment[];
    isLoading: boolean;
    onRequestDelete: (comment: AdminComment) => void;
}

/**
 * 评论管理表格：展示评论内容与归属，支持删除。
 */
export function CommentsTable({
    items,
    isLoading,
    onRequestDelete,
}: CommentsTableProps) {
    return (
        <AdminTableShell
            ariaLabel="评论列表"
            columns={["评论", "作者", "所属作品", "时间", "操作"]}
            isLoading={isLoading}
            empty={
                <EmptyState
                    icon={MessageSquareQuote}
                    title="暂无评论"
                    hint="没有符合条件的评论"
                />
            }
        >
            {items.map((comment) => (
                <Table.Row key={comment.id}>
                    <Table.Cell>
                        <p className="text-sm text-foreground/85 line-clamp-2 max-w-[320px]">
                            {comment.content}
                        </p>
                    </Table.Cell>
                    <Table.Cell>
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar size="sm" className="shrink-0 size-7">
                                {comment.authorImage ? (
                                    <Avatar.Image
                                        alt={comment.authorName ?? "用户"}
                                        src={comment.authorImage}
                                    />
                                ) : null}
                                <Avatar.Fallback>
                                    {(comment.authorName ?? "用")
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase()}
                                </Avatar.Fallback>
                            </Avatar>
                            <span className="text-sm text-foreground/70 truncate">
                                {comment.authorName ?? "未命名用户"}
                            </span>
                        </div>
                    </Table.Cell>
                    <Table.Cell>
                        <Link
                            to="/work/$id"
                            params={{ id: comment.workId }}
                            className="text-sm text-accent hover:underline truncate max-w-[200px]"
                        >
                            {comment.workTitle}
                        </Link>
                    </Table.Cell>
                    <Table.Cell>
                        <span className="text-sm text-foreground/60">
                            {formatDate(comment.createdAt)}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <RowActions
                            label="管理评论"
                            actions={[
                                {
                                    id: "delete",
                                    label: "删除评论",
                                    variant: "danger",
                                },
                            ]}
                            onAction={(key) => {
                                if (key === "delete") {
                                    onRequestDelete(comment);
                                }
                            }}
                        />
                    </Table.Cell>
                </Table.Row>
            ))}
        </AdminTableShell>
    );
}
