import type { ComponentType } from "react";

interface StatBadgeProps {
    icon: ComponentType<{ className?: string }>;
    value: string;
    label: string;
}

export function StatBadge({ icon: Icon, value, label }: StatBadgeProps) {
    return (
        <span className="flex items-center gap-1.5" title={`${value} ${label}`}>
            <Icon className="size-4 text-foreground/45" />
            <span className="font-semibold text-foreground/85 tabular-nums">
                {value}
            </span>
            <span className="text-foreground/45 text-xs">{label}</span>
        </span>
    );
}
