import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

/**
 * 统一页面页头：标题 + 副标题 + 可选右侧操作。
 * @param props.title - 页面标题。
 * @param props.description - 副标题说明，可选。
 * @param props.action - 右侧操作区（如按钮），可选。
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
    return (
        <header className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-balance">
                    {title}
                </h1>
                {action}
            </div>
            {description && (
                <p className="text-sm text-foreground/60">{description}</p>
            )}
        </header>
    );
}
