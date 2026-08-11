import { Spinner } from "@heroui/react";

export function NotificationsSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground/40">
            <Spinner size="sm" />
            <span className="text-sm">正在加载通知…</span>
        </div>
    );
}
