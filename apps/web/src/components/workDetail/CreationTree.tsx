import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, GitFork } from "lucide-react";
import type { Work, WorkSource } from "~/lib/api";
import { formatDate } from "~/lib/format";

export function CreationTree({
    source,
    remixes,
}: {
    source: WorkSource | null;
    remixes: Work[];
}) {
    if (!source && remixes.length === 0) {
        return (
            <p className="text-sm text-foreground/45 py-3 text-center">
                暂无创作脉络
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {source && (
                <div className="flex items-center gap-2 text-sm min-w-0">
                    <ArrowDownLeft className="size-3.5 text-foreground/45 shrink-0" />
                    <span className="text-foreground/55 shrink-0">源自</span>
                    <Link
                        to="/work/$id"
                        params={{ id: source.id }}
                        className="text-accent hover:underline truncate"
                    >
                        《{source.title}》
                    </Link>
                </div>
            )}

            {remixes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-foreground/45">
                        被二创 {remixes.length} 次
                    </span>
                    <div className="flex flex-col gap-0.5">
                        {remixes.map((remix) => (
                            <Link
                                key={remix.id}
                                to="/work/$id"
                                params={{ id: remix.id }}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-default-100/70 transition-colors text-sm min-w-0"
                            >
                                <GitFork className="size-3.5 text-foreground/40 shrink-0" />
                                <span className="truncate">{remix.title}</span>
                                <span className="text-xs text-foreground/40 ml-auto shrink-0">
                                    {formatDate(remix.createdAt)}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
