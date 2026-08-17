import { Button, Modal, Spinner, type useOverlayState } from "@heroui/react";
import { FileDiff, GitCompareArrows } from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useEffect, useMemo, useState } from "react";
import { DiffView } from "~/components/workEditor/DiffView";
import { fetchSnapshot } from "~/lib/api";
import type { Snapshot, SnapshotFile, WorkVersion } from "~/lib/api/types";

interface VersionCompareDialogProps {
    state: ReturnType<typeof useOverlayState>;
    workId: string;
    versions: WorkVersion[];
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    fontSize: number;
    fontFamily: string;
}

type FileStatus = "added" | "deleted" | "modified";

interface ComparedFile {
    key: string;
    name: string;
    status: FileStatus;
    original?: string;
    modified?: string;
}

/**
 * 任意两版本对比。
 * @param props.state - 弹窗开关状态。
 * @param props.workId - 作品 ID。
 * @param props.versions - 版本列表（用于选择对比的两个版本）。
 * @param props.monaco - Monaco 实例，用于展示文件 diff。
 * @remarks 按文件 hash（缺省按内容）判断新增/删除/修改，点击文件用 Monaco diff 展示差异。
 */
export function VersionCompareDialog({
    state,
    workId,
    versions,
    monaco,
    theme,
    fontSize,
    fontFamily,
}: VersionCompareDialogProps) {
    const [fromVersion, setFromVersion] = useState<number | null>(null);
    const [toVersion, setToVersion] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<ComparedFile[] | null>(null);
    const [selected, setSelected] = useState<ComparedFile | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state.isOpen) {
            setFromVersion(null);
            setToVersion(null);
            setFiles(null);
            setSelected(null);
            setError(null);
        }
    }, [state.isOpen]);

    const sorted = useMemo(
        () => [...versions].sort((a, b) => a.version - b.version),
        [versions],
    );

    const compare = async () => {
        if (fromVersion === null || toVersion === null) {
            setError("请选择两个版本");
            return;
        }
        if (fromVersion === toVersion) {
            setError("请选择两个不同的版本");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [from, to] = await Promise.all([
                fetchSnapshot(workId, fromVersion),
                fetchSnapshot(workId, toVersion),
            ]);
            setFiles(diffSnapshots(from, to));
            setSelected(null);
        } catch (err) {
            setError((err as Error).message || "对比失败");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedFile = selected
        ? (files?.find((file) => file.name === selected.name) ?? null)
        : null;

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[640px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading className="flex items-center gap-2">
                                <GitCompareArrows className="size-4" />
                                版本对比
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            {selectedFile && files ? (
                                <div className="flex flex-col gap-2 min-h-64">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium truncate">
                                            {selectedFile.name}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onPress={() => setSelected(null)}
                                        >
                                            返回文件列表
                                        </Button>
                                    </div>
                                    <div className="flex-1 min-h-64 rounded-lg border border-default-200 overflow-hidden">
                                        <DiffView
                                            monaco={monaco}
                                            theme={theme}
                                            fontSize={fontSize}
                                            fontFamily={fontFamily}
                                            original={
                                                selectedFile.original ?? ""
                                            }
                                            modified={
                                                selectedFile.modified ?? ""
                                            }
                                            label={`v${fromVersion} 对比 v${toVersion}`}
                                            onClose={() => setSelected(null)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1.5 text-xs">
                                            对比版本
                                            <select
                                                value={fromVersion ?? ""}
                                                onChange={(event) => {
                                                    setFromVersion(
                                                        event.target.value ===
                                                            ""
                                                            ? null
                                                            : Number(
                                                                  event.target
                                                                      .value,
                                                              ),
                                                    );
                                                }}
                                                className="h-8 w-full px-2 rounded-lg border border-default-200 bg-background text-sm outline-none focus:border-default-400"
                                            >
                                                <option value="">
                                                    选择版本
                                                </option>
                                                {sorted.map((version) => (
                                                    <option
                                                        key={version.version}
                                                        value={version.version}
                                                    >
                                                        v{version.version} ·{" "}
                                                        {version.message ??
                                                            "无说明"}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="flex flex-col gap-1.5 text-xs">
                                            与版本
                                            <select
                                                value={toVersion ?? ""}
                                                onChange={(event) => {
                                                    setToVersion(
                                                        event.target.value ===
                                                            ""
                                                            ? null
                                                            : Number(
                                                                  event.target
                                                                      .value,
                                                              ),
                                                    );
                                                }}
                                                className="h-8 w-full px-2 rounded-lg border border-default-200 bg-background text-sm outline-none focus:border-default-400"
                                            >
                                                <option value="">
                                                    选择版本
                                                </option>
                                                {sorted.map((version) => (
                                                    <option
                                                        key={version.version}
                                                        value={version.version}
                                                    >
                                                        v{version.version} ·{" "}
                                                        {version.message ??
                                                            "无说明"}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onPress={() => void compare()}
                                            isDisabled={isLoading}
                                            className="gap-1.5"
                                        >
                                            {isLoading ? (
                                                <Spinner
                                                    size="sm"
                                                    className="size-4"
                                                />
                                            ) : (
                                                <GitCompareArrows className="size-3.5" />
                                            )}
                                            {isLoading ? "对比中…" : "开始对比"}
                                        </Button>
                                        <span className="text-xs text-foreground/40">
                                            差异按 v{fromVersion ?? "?"} 对比 v
                                            {toVersion ?? "?"}
                                        </span>
                                    </div>
                                    {error && (
                                        <p className="text-xs text-danger">
                                            {error}
                                        </p>
                                    )}
                                    {files && (
                                        <FileDiffList
                                            files={files}
                                            onSelect={setSelected}
                                        />
                                    )}
                                </>
                            )}
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

const STATUS_LABEL: Record<FileStatus, { text: string; className: string }> = {
    added: { text: "新增", className: "bg-success/10 text-success" },
    deleted: { text: "删除", className: "bg-danger/10 text-danger" },
    modified: { text: "修改", className: "bg-warning/10 text-warning" },
};

function FileDiffList({
    files,
    onSelect,
}: {
    files: ComparedFile[];
    onSelect: (file: ComparedFile) => void;
}) {
    if (files.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-6 text-foreground/40">
                <FileDiff className="size-5" strokeWidth={1.5} />
                <p className="text-xs">两个版本没有差异</p>
            </div>
        );
    }
    return (
        <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {files.map((file) => (
                <li key={`${file.status}-${file.name}`}>
                    <button
                        type="button"
                        onClick={() => onSelect(file)}
                        className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-hover"
                    >
                        <span className="truncate">{file.name}</span>
                        <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                                STATUS_LABEL[file.status].className
                            }`}
                        >
                            {STATUS_LABEL[file.status].text}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

/**
 * 比较两个快照，按文件名匹配，通过 hash（缺省按内容）判断是否修改。
 */
function diffSnapshots(from: Snapshot, to: Snapshot): ComparedFile[] {
    const byName = (files: SnapshotFile[]) =>
        new Map(files.map((file) => [file.name, file]));
    const fromMap = byName(from.files);
    const toMap = byName(to.files);
    const compared: ComparedFile[] = [];

    for (const [name, file] of toMap) {
        const original = fromMap.get(name);
        if (!original) {
            compared.push({
                key: file.key,
                name,
                status: "added",
                modified: file.content,
            });
            continue;
        }
        if (fileHash(file) !== fileHash(original)) {
            compared.push({
                key: file.key,
                name,
                status: "modified",
                original: original.content,
                modified: file.content,
            });
        }
    }

    for (const [name, file] of fromMap) {
        if (!toMap.has(name)) {
            compared.push({
                key: file.key,
                name,
                status: "deleted",
                original: file.content,
            });
        }
    }

    const order: Record<FileStatus, number> = {
        added: 0,
        deleted: 1,
        modified: 2,
    };
    return compared.sort(
        (a, b) =>
            order[a.status] - order[b.status] || a.name.localeCompare(b.name),
    );
}

function fileHash(file: SnapshotFile): string {
    return file.hash ?? file.content;
}
