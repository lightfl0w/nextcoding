import { Card } from "@heroui/react";
import {
    Crown,
    Flame,
    Heart,
    MessageCircle,
    Rocket,
    Sparkles,
    Star,
    Target,
    Trophy,
    Zap,
} from "lucide-react";
import { memo } from "react";
import type { Achievement } from "~/lib/api";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Sparkles,
    Star,
    Crown,
    Rocket,
    Flame,
    Heart,
    MessageCircle,
    Target,
    Trophy,
    Zap,
};

interface AchievementBadgeProps {
    achievement: Achievement;
    unlocked?: boolean;
    progress?: number;
    showProgress?: boolean;
}

/**
 * 成就徽章卡片。
 * @param props.achievement - 成就数据。
 * @param props.unlocked - 是否已解锁。
 * @param props.progress - 当前进度 (0-100)。
 * @param props.showProgress - 是否显示进度条。
 */
export const AchievementBadge = memo(function AchievementBadge({
    achievement,
    unlocked = false,
    progress = 0,
    showProgress = false,
}: AchievementBadgeProps) {
    const Icon = ICON_MAP[achievement.icon] ?? Star;

    return (
        <Card
            className={`p-0 shadow-none rounded-2xl border transition-colors ${
                unlocked
                    ? "border-primary/30 bg-primary/5"
                    : "border-default-200/70 opacity-60 grayscale"
            }`}
        >
            <Card.Content className="p-4 flex flex-col items-center gap-2 text-center">
                <div
                    className={`size-12 rounded-full flex items-center justify-center ${
                        unlocked
                            ? "bg-primary/15 text-primary"
                            : "bg-default-100/70 text-foreground/30"
                    }`}
                >
                    <Icon className="size-6" />
                </div>
                <div className="flex flex-col gap-0.5">
                    <p
                        className={`text-sm font-semibold ${
                            unlocked ? "text-foreground" : "text-foreground/50"
                        }`}
                    >
                        {achievement.name}
                    </p>
                    <p className="text-xs text-foreground/45 line-clamp-2">
                        {achievement.description}
                    </p>
                </div>
                {showProgress && !unlocked && (
                    <div className="w-full max-w-24">
                        <div className="h-1.5 w-full rounded-full bg-default-200/70 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-foreground/40 mt-0.5 text-center">
                            {progress}%
                        </p>
                    </div>
                )}
            </Card.Content>
        </Card>
    );
});
