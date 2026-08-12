import type { ReactNode } from "react";

interface SectionHeadingProps {
    title: string;
    action?: ReactNode;
}

/**
 * 统一分区标题：标题 + 可选右侧操作。
 * @param props.title - 分区标题。
 * @param props.action - 右侧操作区（如「查看全部」），可选。
 */
export function SectionHeading({ title, action }: SectionHeadingProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {action}
        </div>
    );
}
