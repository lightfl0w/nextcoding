import { Button, Checkbox, Chip, Input, useOverlayState } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Bookmark, GitFork, Play, Rocket, Settings2, X } from "lucide-react";
import { useState } from "react";
import {
    EDITOR_FONT_OPTIONS,
    EDITOR_FONT_SIZE_MAX,
    EDITOR_FONT_SIZE_MIN,
} from "~/hooks/useEditorSettings";
import type { WorkSource } from "~/lib/api";
import { SaveDraftModal } from "./SaveDraftModal";

interface EditorHeaderProps {
    fileCount: number;
    isSaving: boolean;
    isRunning: boolean;
    isComparing: boolean;
    title: string;
    isPublished: boolean;
    source: WorkSource | null;
    fontSize: number;
    fontFamily: string;
    autoSaveDraft: boolean;
    onTitleChange: (value: string) => void;
    onTitleSave: () => void;
    onExitCompare: () => void;
    onRun: () => void;
    onSaveDraft: (message: string) => void;
    onPublishWork: () => void;
    onFontSizeChange: (value: number) => void;
    onFontFamilyChange: (value: string) => void;
    onAutoSaveDraftChange: (value: boolean) => void;
}

const SELECT_CLASS =
    "h-8 w-full px-2 rounded-lg border border-default-200 bg-background text-sm outline-none focus:border-default-400";

export function EditorHeader({
    fileCount,
    isSaving,
    isRunning,
    isComparing,
    title,
    isPublished,
    source,
    fontSize,
    fontFamily,
    autoSaveDraft,
    onTitleChange,
    onTitleSave,
    onExitCompare,
    onRun,
    onSaveDraft,
    onPublishWork,
    onFontSizeChange,
    onFontFamilyChange,
    onAutoSaveDraftChange,
}: EditorHeaderProps) {
    const draftState = useOverlayState();
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

            <EditorSettingsMenu
                fontSize={fontSize}
                fontFamily={fontFamily}
                autoSaveDraft={autoSaveDraft}
                onFontSizeChange={onFontSizeChange}
                onFontFamilyChange={onFontFamilyChange}
                onAutoSaveDraftChange={onAutoSaveDraftChange}
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
            <Button size="sm" onPress={draftState.open} className="gap-1.5">
                <Bookmark className="size-3.5" />
                保存草稿
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
            <SaveDraftModal
                state={draftState}
                isSaving={isSaving}
                onConfirm={onSaveDraft}
            />
        </header>
    );
}

/**
 * 编辑器设置弹层。
 * @param props.fontSize - 当前字号。
 * @param props.fontFamily - 当前字体。
 * @param props.autoSaveDraft - 是否自动保存草稿。
 * @param props.onFontSizeChange - 修改字号。
 * @param props.onFontFamilyChange - 修改字体。
 * @param props.onAutoSaveDraftChange - 切换自动保存草稿。
 * @remarks 自持展开状态，点击遮罩关闭。
 */
function EditorSettingsMenu({
    fontSize,
    fontFamily,
    autoSaveDraft,
    onFontSizeChange,
    onFontFamilyChange,
    onAutoSaveDraftChange,
}: {
    fontSize: number;
    fontFamily: string;
    autoSaveDraft: boolean;
    onFontSizeChange: (value: number) => void;
    onFontFamilyChange: (value: string) => void;
    onAutoSaveDraftChange: (value: boolean) => void;
}) {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const fontSizes = Array.from(
        { length: EDITOR_FONT_SIZE_MAX - EDITOR_FONT_SIZE_MIN + 1 },
        (_, index) => EDITOR_FONT_SIZE_MIN + index,
    );

    return (
        <div className="relative shrink-0">
            <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label="编辑器设置"
                onPress={() => setSettingsOpen((open) => !open)}
            >
                <Settings2 className="size-3.5" />
            </Button>
            {settingsOpen && (
                <>
                    <button
                        type="button"
                        aria-label="关闭设置"
                        onClick={() => setSettingsOpen(false)}
                        className="fixed inset-0 z-40 cursor-default"
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-default-200 bg-background p-3 flex flex-col gap-3 shadow-lg">
                        <label className="flex flex-col gap-1 text-xs">
                            字号
                            <select
                                value={fontSize}
                                onChange={(event) =>
                                    onFontSizeChange(Number(event.target.value))
                                }
                                className={SELECT_CLASS}
                            >
                                {fontSizes.map((size) => (
                                    <option key={size} value={size}>
                                        {size}px
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs">
                            字体
                            <select
                                value={fontFamily}
                                onChange={(event) =>
                                    onFontFamilyChange(event.target.value)
                                }
                                className={SELECT_CLASS}
                            >
                                {EDITOR_FONT_OPTIONS.map((font) => (
                                    <option
                                        key={font.value}
                                        value={font.value}
                                        style={{
                                            fontFamily: font.value,
                                        }}
                                    >
                                        {font.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Checkbox
                            isSelected={autoSaveDraft}
                            onChange={(selected) =>
                                onAutoSaveDraftChange(selected)
                            }
                        >
                            <Checkbox.Content>
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                自动保存草稿
                            </Checkbox.Content>
                        </Checkbox>
                    </div>
                </>
            )}
        </div>
    );
}
