import type { AdminStats } from "~/lib/api/admin";

interface TrendChartProps {
    trend: AdminStats["trend"];
}

/**
 * 近 7 天新增趋势柱状图：纯 CSS 实现，无外部图表依赖。
 * 用户数（accent）与作品数（secondary）两组柱。
 */
export function TrendChart({ trend }: TrendChartProps) {
    const maxUsers = Math.max(...trend.map((d) => d.users), 1);
    const maxWorks = Math.max(...trend.map((d) => d.works), 1);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-xs text-foreground/50">
                <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-accent" />
                    新增用户
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-default-400" />
                    新增作品
                </span>
            </div>
            <div className="flex items-end justify-between gap-2 h-36">
                {trend.map((day) => (
                    <div
                        key={day.date}
                        className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
                    >
                        <div className="flex items-end gap-1 h-28 w-full">
                            <Bar
                                height={Math.round(
                                    (day.users / maxUsers) * 100,
                                )}
                                className="bg-accent"
                                label={`${day.users} 位新用户`}
                            />
                            <Bar
                                height={Math.round(
                                    (day.works / maxWorks) * 100,
                                )}
                                className="bg-default-400"
                                label={`${day.works} 个新作品`}
                            />
                        </div>
                        <span className="text-[11px] text-foreground/45 tabular-nums">
                            {day.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Bar({
    height,
    className,
    label,
}: {
    height: number;
    className: string;
    label: string;
}) {
    return (
        <div
            role="img"
            aria-label={label}
            title={label}
            className={`flex-1 rounded-t-md min-h-1 transition-all ${className}`}
            style={{ height: `${Math.max(height, 2)}%` }}
        />
    );
}
