import { Card } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: number;
    hint?: string;
}

/**
 * 仪表盘指标卡：图标 + 数值（等宽数字）+ 说明。
 */
export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
    return (
        <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
            <Card.Content className="flex items-start gap-3 p-4">
                <div className="size-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Icon className="size-4.5" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs text-foreground/50">{label}</span>
                    <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                        {value.toLocaleString()}
                    </span>
                    {hint && (
                        <span className="text-[11px] text-foreground/40">
                            {hint}
                        </span>
                    )}
                </div>
            </Card.Content>
        </Card>
    );
}
