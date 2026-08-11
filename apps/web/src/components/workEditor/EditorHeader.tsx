import { Button, Chip, Input } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { GitFork, Play, Rocket, Upload, X } from "lucide-react";
import type { WorkSource } from "~/lib/api";

interface EditorHeaderProps {
    fileCount: number;
    isSaving: boolean;
    isRunning: boolean;
    isComparing: boolean;
    title: string;
    isPublished: boolean;
    versionMessage: string;
    source: WorkSource | null;
    onTitleChange: (value: string) => void;
    onTitleSave: () => void;
    onVersionMessageChange: (value: string) => void;
    onExitCompare: () => void;
    onRun: () => void;
    onPublishVersion: () => void;
    onPublishWork: () => void;
}

export function EditorHeader({
    fileCount,
    isSaving,
    isRunning,
    isComparing,
    title,
    isPublished,
    versionMessage,
    source,
    onTitleChange,
    onTitleSave,
    onVersionMessageChange,
    onExitCompare,
    onRun,
    onPublishVersion,
    onPublishWork,
}: EditorHeaderProps) {
    return (
        <header className="flex items-center gap-2 border-b border-default-200 px-4 py-2 shrink-0">
            <Link
                to="/"
                title="返回首页"
                preload="intent"
                className="flex items-center gap-2 mr-3 shrink-0"
            >
                <img
                    src="/logo.png"
                    alt="NextCoding 吉祥物"
                    className="w-7 h-7 rounded-lg object-cover"
                />
                <span className="text-base font-bold tracking-tight">
                    NextCoding
                </span>
            </Link>

            <Input
                className="w-44"
                placeholder="作品标题"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur();
                    }
                }}
                onBlur={onTitleSave}
            />
            <Chip size="sm" variant="soft">
                {fileCount} 个文件
            </Chip>
            {source && (
                <Link
                    to="/work/$id"
                    params={{ id: source.id }}
                    className="shrink-0"
                >
                    <Chip size="sm" variant="soft" className="gap-1">
                        <GitFork className="size-3" />
                        源自《{source.title}》
                    </Chip>
                </Link>
            )}
            {isSaving && (
                <span className="flex items-center gap-1.5 text-xs text-foreground/50">
                    <span className="size-1.5 rounded-full bg-warning animate-pulse" />
                    保存中…
                </span>
            )}

            <div className="flex-1" />

            {isComparing && (
                <Button
                    size="sm"
                    variant="ghost"
                    onPress={onExitCompare}
                    className="gap-1.5"
                >
                    <X className="size-3.5" />
                    退出对比
                </Button>
            )}

            <Input
                className="w-56"
                placeholder="版本说明（可选）"
                value={versionMessage}
                onChange={(event) => onVersionMessageChange(event.target.value)}
                onKeyDown={(event) =>
                    event.key === "Enter" && onPublishVersion()
                }
            />
            <Button
                size="sm"
                variant="primary"
                onPress={onRun}
                isDisabled={isRunning}
                className="gap-1.5"
            >
                <Play className="size-3.5" />
                {isRunning ? "运行中…" : "运行"}
            </Button>
            <Button size="sm" onPress={onPublishVersion} className="gap-1.5">
                <Upload className="size-3.5" />
                发布版本
            </Button>
            {isPublished ? (
                <Chip size="sm" variant="primary" className="gap-1">
                    <Rocket className="size-3.5" />
                    已发布
                </Chip>
            ) : (
                <Button
                    size="sm"
                    variant="primary"
                    onPress={onPublishWork}
                    className="gap-1.5"
                >
                    <Rocket className="size-3.5" />
                    发布
                </Button>
            )}
        </header>
    );
}
