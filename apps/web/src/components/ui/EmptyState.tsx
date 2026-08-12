import { Card } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    hint?: string;
    action?: ReactNode;
}

/**
 * 通用空状态：虚线边框容器 + 图标 + 标题 + 说明。
 * @param props.icon - 图标组件。
 * @param props.title - 主文案。
 * @param props.hint - 补充说明，可选。
 * @param props.action - 可选操作区（如按钮）。
 */
export function EmptyState({
    icon: Icon,
    title,
    hint,
    action,
}: EmptyStateProps) {
    return (
        <Card className="p-0 shadow-none rounded-2xl border border-dashed border-default-300 bg-background">
            <Card.Content className="py-16 flex flex-col items-center gap-3 text-foreground/45">
                <div className="size-12 rounded-full bg-default-100/70 flex items-center justify-center">
                    <Icon className="size-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-sm font-medium text-foreground/65">
                        {title}
                    </p>
                    {hint && (
                        <p className="text-xs text-foreground/40">{hint}</p>
                    )}
                </div>
                {action && <div className="mt-1">{action}</div>}
            </Card.Content>
        </Card>
    );
}
