import { Button, Input } from "@heroui/react";
import {
    ChevronDown,
    ChevronRight,
    FileCode2,
    FilePlus2,
    Folder,
    FolderOpen,
    Pencil,
    Trash2,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { WorkFile } from "~/lib/api";
import {
    buildFileTree,
    type FileTreeNode,
    type FolderNode,
} from "~/lib/fileTree";
import { ConfirmButton } from "./ConfirmButton";

interface FileExplorerProps {
    files: WorkFile[];
    activeKey: string | null;
    isComposing: boolean;
    draftName: string;
    nameError: string | null;
    renamingKey: string | null;
    renameDraft: string;
    onOpenFile: (key: string) => void;
    onDeleteFile: (file: WorkFile) => void;
    onDeleteFolder: (folder: string) => void;
    onStartComposing: () => void;
    onCancelComposing: () => void;
    onChangeDraftName: (value: string) => void;
    onConfirmComposing: () => void;
    onStartRename: (file: WorkFile) => void;
    onCancelRename: () => void;
    onChangeRenameDraft: (value: string) => void;
    onConfirmRename: () => void;
}

interface TreeRowProps {
    node: FileTreeNode;
    depth: number;
    collapsed: ReadonlySet<string>;
    activeKey: string | null;
    nameError: string | null;
    renamingKey: string | null;
    renameDraft: string;
    onToggleFolder: (path: string) => void;
    onOpenFile: (key: string) => void;
    onDeleteFile: (file: WorkFile) => void;
    onDeleteFolder: (folder: string) => void;
    onStartRename: (file: WorkFile) => void;
    onCancelRename: () => void;
    onChangeRenameDraft: (value: string) => void;
    onConfirmRename: () => void;
}

/**
 * 文件树。
 * @param props.files - 作品文件列表。
 * @param props.activeKey - 当前打开文件。
 * @param props.isComposing - 是否新建输入中。
 * @param props.draftName - 新建文件名。
 * @param props.nameError - 文件名校验错误。
 * @param props.renamingKey - 正在重命名的文件 key。
 * @param props.renameDraft - 重命名输入值。
 * @param props.onOpenFile - 打开文件。
 * @param props.onDeleteFile - 删除文件。
 * @param props.onDeleteFolder - 删除文件夹。
 * @param props.onStartComposing - 开始新建。
 * @param props.onCancelComposing - 取消新建。
 * @param props.onChangeDraftName - 修改新建文件名。
 * @param props.onConfirmComposing - 确认新建。
 * @param props.onStartRename - 开始重命名。
 * @param props.onCancelRename - 取消重命名。
 * @param props.onChangeRenameDraft - 修改重命名文件名。
 * @param props.onConfirmRename - 确认重命名。
 * @remarks 按目录折叠，支持新建、重命名与删除（文件/文件夹）。
 */
export const FileExplorer = memo(function FileExplorer({
    files,
    activeKey,
    isComposing,
    draftName,
    nameError,
    renamingKey,
    renameDraft,
    onOpenFile,
    onDeleteFile,
    onDeleteFolder,
    onStartComposing,
    onCancelComposing,
    onChangeDraftName,
    onConfirmComposing,
    onStartRename,
    onCancelRename,
    onChangeRenameDraft,
    onConfirmRename,
}: FileExplorerProps) {
    const tree = useMemo(() => buildFileTree(files), [files]);
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
        new Set<string>(),
    );

    useEffect(() => {
        const livePaths = collectFolderPaths(files);
        setCollapsed((current) => {
            const next = new Set(
                [...current].filter((path) => livePaths.has(path)),
            );
            return next.size === current.size ? current : next;
        });
    }, [files]);

    const toggleFolder = (path: string) => {
        setCollapsed((current) => toggleSetItem(current, path));
    };

    return (
        <aside className="w-52 border-r border-default-200 overflow-y-auto p-2 flex flex-col gap-1 shrink-0">
            <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-medium text-foreground/60">
                    文件
                </span>
                <button
                    type="button"
                    onClick={onStartComposing}
                    title="新建文件"
                    className="p-1 rounded-md hover:bg-default-100 text-foreground/60"
                >
                    <FilePlus2 className="size-3.5" />
                </button>
            </div>

            {isComposing && (
                <InlineNameInput
                    placeholder="文件名（如 main.js / src/index.js）"
                    draftName={draftName}
                    nameError={nameError}
                    onChangeDraftName={onChangeDraftName}
                    onConfirm={onConfirmComposing}
                    onCancel={onCancelComposing}
                />
            )}

            {tree.map((node) => (
                <TreeRow
                    key={node.kind === "folder" ? node.path : node.file.key}
                    node={node}
                    depth={0}
                    collapsed={collapsed}
                    activeKey={activeKey}
                    nameError={nameError}
                    renamingKey={renamingKey}
                    renameDraft={renameDraft}
                    onToggleFolder={toggleFolder}
                    onOpenFile={onOpenFile}
                    onDeleteFile={onDeleteFile}
                    onDeleteFolder={onDeleteFolder}
                    onStartRename={onStartRename}
                    onCancelRename={onCancelRename}
                    onChangeRenameDraft={onChangeRenameDraft}
                    onConfirmRename={onConfirmRename}
                />
            ))}
        </aside>
    );
});

function TreeRow(props: TreeRowProps) {
    return props.node.kind === "folder" ? (
        <FolderRow {...props} node={props.node} />
    ) : (
        <FileRow {...props} node={props.node} />
    );
}

function FolderRow({
    node,
    depth,
    collapsed,
    activeKey,
    nameError,
    renamingKey,
    renameDraft,
    onToggleFolder,
    onOpenFile,
    onDeleteFile,
    onDeleteFolder,
    onStartRename,
    onCancelRename,
    onChangeRenameDraft,
    onConfirmRename,
}: {
    node: FolderNode;
    depth: number;
    collapsed: ReadonlySet<string>;
    activeKey: string | null;
    nameError: string | null;
    renamingKey: string | null;
    renameDraft: string;
    onToggleFolder: (path: string) => void;
    onOpenFile: (key: string) => void;
    onDeleteFile: (file: WorkFile) => void;
    onDeleteFolder: (folder: string) => void;
    onStartRename: (file: WorkFile) => void;
    onCancelRename: () => void;
    onChangeRenameDraft: (value: string) => void;
    onConfirmRename: () => void;
}) {
    const isCollapsed = collapsed.has(node.path);
    const indent = 12 + depth * 14;

    return (
        <>
            <div
                style={{ paddingLeft: indent }}
                className="group flex items-center rounded-lg pr-1 text-sm text-foreground/80 transition-colors hover:bg-default-100"
            >
                <button
                    type="button"
                    onClick={() => onToggleFolder(node.path)}
                    className="flex-1 text-left truncate py-1.5 flex items-center gap-1.5 min-w-0"
                >
                    {isCollapsed ? (
                        <ChevronRight className="size-3.5 shrink-0 text-foreground/40" />
                    ) : (
                        <ChevronDown className="size-3.5 shrink-0 text-foreground/40" />
                    )}
                    {isCollapsed ? (
                        <Folder className="size-3.5 shrink-0 text-foreground/50" />
                    ) : (
                        <FolderOpen className="size-3.5 shrink-0 text-foreground/50" />
                    )}
                    <span className="truncate">{node.name}</span>
                </button>
                <ConfirmButton
                    heading={`删除文件夹 ${node.name}？`}
                    description="将删除该文件夹下的所有文件，此操作不可恢复。"
                    confirmLabel="确认删除"
                    onConfirm={() => onDeleteFolder(node.path)}
                    trigger={
                        <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`删除文件夹 ${node.name}`}
                            className={rowActionButtonClassName(false)}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    }
                />
            </div>
            {!isCollapsed &&
                node.children.map((child) => (
                    <TreeRow
                        key={
                            child.kind === "folder"
                                ? child.path
                                : child.file.key
                        }
                        node={child}
                        depth={depth + 1}
                        collapsed={collapsed}
                        activeKey={activeKey}
                        nameError={nameError}
                        renamingKey={renamingKey}
                        renameDraft={renameDraft}
                        onToggleFolder={onToggleFolder}
                        onOpenFile={onOpenFile}
                        onDeleteFile={onDeleteFile}
                        onDeleteFolder={onDeleteFolder}
                        onStartRename={onStartRename}
                        onCancelRename={onCancelRename}
                        onChangeRenameDraft={onChangeRenameDraft}
                        onConfirmRename={onConfirmRename}
                    />
                ))}
        </>
    );
}

function FileRow({
    node,
    depth,
    activeKey,
    nameError,
    renamingKey,
    renameDraft,
    onOpenFile,
    onDeleteFile,
    onStartRename,
    onCancelRename,
    onChangeRenameDraft,
    onConfirmRename,
}: {
    node: Extract<FileTreeNode, { kind: "file" }>;
    depth: number;
    activeKey: string | null;
    nameError: string | null;
    renamingKey: string | null;
    renameDraft: string;
    onOpenFile: (key: string) => void;
    onDeleteFile: (file: WorkFile) => void;
    onStartRename: (file: WorkFile) => void;
    onCancelRename: () => void;
    onChangeRenameDraft: (value: string) => void;
    onConfirmRename: () => void;
}) {
    const indent = 12 + depth * 14;
    const isActive = activeKey === node.file.key;
    const isRenaming = renamingKey === node.file.key;

    if (isRenaming) {
        return (
            <div style={{ paddingLeft: indent }} className="py-1 pr-1">
                <InlineNameInput
                    placeholder="文件名（如 main.js / src/index.js）"
                    draftName={renameDraft}
                    nameError={nameError}
                    onChangeDraftName={onChangeRenameDraft}
                    onConfirm={onConfirmRename}
                    onCancel={onCancelRename}
                />
            </div>
        );
    }

    return (
        <div
            style={{ paddingLeft: indent }}
            className={fileRowClassName(isActive)}
        >
            <button
                type="button"
                onClick={() => onOpenFile(node.file.key)}
                title={node.file.name}
                className="flex-1 text-left truncate py-1.5 flex items-center gap-1.5 min-w-0"
            >
                <FileCode2 className="size-3.5 shrink-0 text-foreground/40" />
                <span className="truncate">{node.name}</span>
            </button>
            <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label={`重命名 ${node.file.name}`}
                onPress={() => onStartRename(node.file)}
                className={rowActionButtonClassName(isActive)}
            >
                <Pencil className="size-3.5" />
            </Button>
            <ConfirmButton
                heading={`删除 ${node.file.name}？`}
                description="将永久删除该文件及其内容，此操作不可恢复。"
                confirmLabel="确认删除"
                onConfirm={() => onDeleteFile(node.file)}
                trigger={
                    <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`删除 ${node.file.name}`}
                        className={rowActionButtonClassName(isActive)}
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                }
            />
        </div>
    );
}

function collectFolderPaths(files: WorkFile[]): Set<string> {
    const paths = new Set<string>();
    for (const file of files) {
        const slash = file.name.lastIndexOf("/");
        if (slash === -1) {
            continue;
        }
        paths.add(file.name.slice(0, slash));
    }
    return paths;
}

/**
 * 切换集合元素。
 * @param set - 原集合。
 * @param item - 目标元素。
 * @returns 含/不含该元素的新集合。
 */
function toggleSetItem<T>(set: ReadonlySet<T>, item: T): Set<T> {
    const next = new Set(set);
    if (next.has(item)) {
        next.delete(item);
    } else {
        next.add(item);
    }
    return next;
}

/**
 * 文件行样式。
 * @param isActive - 是否当前打开。
 * @returns 完整 className。
 */
function fileRowClassName(isActive: boolean): string {
    const stateClass = isActive
        ? "bg-primary-100 text-primary"
        : "hover:bg-default-100 text-foreground/80";
    return `group flex items-center rounded-lg pr-1 text-sm transition-colors ${stateClass}`;
}

/**
 * 行内操作按钮样式。
 * @param isActive - 是否当前打开。
 * @returns 完整 className。
 */
function rowActionButtonClassName(isActive: boolean): string {
    const visibilityClass = isActive
        ? "opacity-100"
        : "opacity-0 group-hover:opacity-100";
    return `size-6 min-w-0 text-foreground/50 ${visibilityClass}`;
}

/**
 * 行内文件名输入框（新建/重命名共用）。
 * @param props.placeholder - 输入占位文案。
 * @param props.draftName - 输入值。
 * @param props.nameError - 校验错误。
 * @param props.onChangeDraftName - 修改文件名。
 * @param props.onConfirm - 确认。
 * @param props.onCancel - 取消。
 */
function InlineNameInput({
    placeholder,
    draftName,
    nameError,
    onChangeDraftName,
    onConfirm,
    onCancel,
}: {
    placeholder: string;
    draftName: string;
    nameError: string | null;
    onChangeDraftName: (value: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col gap-0.5 px-1 pb-1">
            <Input
                ref={inputRef}
                autoFocus
                className="w-full"
                placeholder={placeholder}
                value={draftName}
                aria-invalid={nameError !== null}
                onChange={(event) => onChangeDraftName(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        onConfirm();
                    }
                    if (event.key === "Escape") {
                        onCancel();
                    }
                }}
            />
            {nameError && (
                <p className="text-xs text-danger px-1">{nameError}</p>
            )}
        </div>
    );
}
