import { Pagination } from "@heroui/react";

interface AdminPaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
}

/**
 * 管理列表分页控件；不足一页时不渲染。
 */
export function AdminPagination({
    page,
    pageSize,
    total,
    onPageChange,
}: AdminPaginationProps) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) {
        return null;
    }

    return (
        <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-foreground/45 tabular-nums">
                共 {total.toLocaleString()} 条
            </p>
            <Pagination>
                <Pagination.Content>
                    <Pagination.Item>
                        <Pagination.Previous
                            aria-label="上一页"
                            isDisabled={page <= 1}
                            onPress={() => onPageChange(page - 1)}
                        >
                            <Pagination.PreviousIcon />
                        </Pagination.Previous>
                    </Pagination.Item>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (p) => (
                            <Pagination.Item key={p}>
                                <Pagination.Link
                                    isActive={p === page}
                                    onPress={() => onPageChange(p)}
                                >
                                    {p}
                                </Pagination.Link>
                            </Pagination.Item>
                        ),
                    )}
                    <Pagination.Item>
                        <Pagination.Next
                            aria-label="下一页"
                            isDisabled={page >= totalPages}
                            onPress={() => onPageChange(page + 1)}
                        >
                            <Pagination.NextIcon />
                        </Pagination.Next>
                    </Pagination.Item>
                </Pagination.Content>
            </Pagination>
        </div>
    );
}
