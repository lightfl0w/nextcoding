import { Button, Skeleton } from "@heroui/react";
import { Link } from "@tanstack/react-router";

export function WorkDetailSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-6 lg:px-10 pt-10 pb-16 flex flex-col gap-8">
            <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-5 w-44 rounded-md" />
            </div>
            <Skeleton className="h-65 w-full rounded-2xl" />
            <div className="flex flex-col gap-3">
                <Skeleton className="h-9 w-2/3 rounded-lg" />
                <Skeleton className="h-4 w-64 rounded-md" />
            </div>
            <div className="flex flex-col lg:flex-row gap-8">
                <Skeleton className="h-72 w-full flex-1 rounded-2xl" />
                <Skeleton className="h-40 w-full lg:w-80 rounded-2xl" />
            </div>
        </div>
    );
}

export function WorkNotFound() {
    return (
        <div className="w-full flex flex-col items-center gap-3 py-24">
            <p className="text-base font-medium">作品不存在或已被删除</p>
            <Link to="/discover">
                <Button variant="ghost" size="sm">
                    返回发现页
                </Button>
            </Link>
        </div>
    );
}
