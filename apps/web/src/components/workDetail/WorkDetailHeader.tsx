import { Button } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Pencil, Undo2 } from "lucide-react";

interface WorkDetailHeaderProps {
    title: string;
    workId: string;
    canEdit: boolean;
}

export function WorkDetailHeader({
    title,
    workId,
    canEdit,
}: WorkDetailHeaderProps) {
    return (
        <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-10 py-3 border-b border-default-200 bg-background-secondary/30 backdrop-blur-xl flex items-center gap-3 min-w-0">
            <Link
                to="/discover"
                title="返回发现页"
                className="size-9 -ml-1 rounded-xl flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-hover transition-colors shrink-0"
            >
                <Undo2 className="size-4" />
            </Link>

            <span className="text-sm font-semibold tracking-tight truncate">
                {title}
            </span>
            <div className="flex-1" />

            {canEdit && (
                <Link to="/work/$id/edit" params={{ id: workId }}>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 shrink-0"
                    >
                        <Pencil className="size-3.5" />
                        编辑
                    </Button>
                </Link>
            )}
        </header>
    );
}
