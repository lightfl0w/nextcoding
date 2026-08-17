import {
    Button,
    Input,
    Label,
    Modal,
    TextField,
    useOverlayState,
} from "@heroui/react";
import {
    Download,
    GitCompareArrows,
    History,
    Pencil,
    RotateCcw,
    Share,
    Trash2,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import type { WorkVersion } from "~/lib/api";
import { formatDate } from "~/lib/format";

interface VersionHistoryPanelProps {
    versions: WorkVersion[];
    onCompare: (version: number) => void;
    onRestore: (version: number) => void;
    onRemove: (version: number) => Promise<boolean>;
    onRename: (version: number, message: string | null) => Promise<boolean>;
    onCompareVersions: () => void;
    onExportGit: () => void;
    onPushRemote: () => void;
    isBusy: boolean;
}

export const VersionHistoryPanel = memo(function VersionHistoryPanel({
    versions,
    onCompare,
    onRestore,
    onRemove,
    onRename,
    onCompareVersions,
    onExportGit,
    onPushRemote,
    isBusy,
}: VersionHistoryPanelProps) {
    return (
        <aside className="w-64 border-l border-default-200 overflow-y-auto p-3 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-foreground/60">
                    版本历史
                </div>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        title="任意两版本对比"
                        onClick={onCompareVersions}
                        disabled={versions.length < 2 || isBusy}
                        className="p-1 rounded-md hover:bg-hover text-foreground/60 disabled:opacity-40"
                    >
                        <GitCompareArrows className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        title="导出 Git 仓库（zip）"
                        onClick={onExportGit}
                        disabled={isBusy}
                        className="p-1 rounded-md hover:bg-hover text-foreground/60 disabled:opacity-40"
                    >
                        <Download className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        title="推送远程仓库"
                        onClick={onPushRemote}
                        disabled={isBusy}
                        className="p-1 rounded-md hover:bg-hover text-foreground/60 disabled:opacity-40"
                    >
                        <Share className="size-3.5" />
                    </button>
                </div>
            </div>

            {versions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-foreground/40">
                    <History className="size-5" strokeWidth={1.5} />
                    <p className="text-xs text-center px-2">
                        还没有版本，点右上角「保存草稿」
                    </p>
                </div>
            ) : (
                versions.map((version) => (
                    <VersionRow
                        key={version.version}
                        version={version}
                        onCompare={() => onCompare(version.version)}
                        onRestore={() => onRestore(version.version)}
                        onRemove={() => onRemove(version.version)}
                        onRename={(message) =>
                            onRename(version.version, message)
                        }
                    />
                ))
            )}
        </aside>
    );
});

function VersionRow({
    version,
    onCompare,
    onRestore,
    onRemove,
    onRename,
}: {
    version: WorkVersion;
    onCompare: () => void;
    onRestore: () => void;
    onRemove: () => Promise<boolean>;
    onRename: (message: string | null) => Promise<boolean>;
}) {
    const renameState = useOverlayState();

    return (
        <div className="rounded-lg border border-default-200 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">v{version.version}</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="对比当前草稿"
                        onClick={onCompare}
                        className="p-1 rounded-md hover:bg-hover text-foreground/60"
                    >
                        <GitCompareArrows className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        title="修改版本说明"
                        onClick={renameState.open}
                        className="p-1 rounded-md hover:bg-hover text-foreground/60"
                    >
                        <Pencil className="size-3.5" />
                    </button>
                    <ConfirmDialog
                        heading={`回滚到 v${version.version}？`}
                        description={`将用 v${version.version} 的内容覆盖当前草稿，当前未发布的修改会丢失。历史版本不会被删除。`}
                        confirmLabel="确认回滚"
                        onConfirm={onRestore}
                        trigger={
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label={`回滚到 v${version.version}`}
                            >
                                <RotateCcw className="size-3.5" />
                            </Button>
                        }
                    />
                    <ConfirmDialog
                        heading={`删除 v${version.version}？`}
                        description="删除后该版本不可恢复，但其它版本与当前草稿不受影响。"
                        confirmLabel="确认删除"
                        onConfirm={onRemove}
                        trigger={
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label={`删除 v${version.version}`}
                            >
                                <Trash2 className="size-3.5 text-danger" />
                            </Button>
                        }
                    />
                </div>
            </div>
            <span
                className="text-xs text-foreground/60 truncate"
                title={version.message ?? undefined}
            >
                {version.message ?? "无说明"}
            </span>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-foreground/40 truncate">
                    {version.author?.name ?? "未知"} ·{" "}
                    {formatDate(version.createdAt)}
                </span>
            </div>
            <RenameVersionDialog
                state={renameState}
                version={version.version}
                initialMessage={version.message ?? ""}
                onConfirm={onRename}
            />
        </div>
    );
}

function RenameVersionDialog({
    state,
    version,
    initialMessage,
    onConfirm,
}: {
    state: ReturnType<typeof useOverlayState>;
    version: number;
    initialMessage: string;
    onConfirm: (message: string | null) => Promise<boolean>;
}) {
    const [message, setMessage] = useState(initialMessage);

    useEffect(() => {
        if (state.isOpen) {
            setMessage(initialMessage);
        }
    }, [state.isOpen, initialMessage]);

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[400px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>修改版本说明</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <TextField
                                className="flex flex-col gap-1.5"
                                value={message}
                                onChange={setMessage}
                            >
                                <Label className="text-xs text-foreground/60">
                                    v{version} 的版本说明
                                </Label>
                                <Input
                                    placeholder="例如：修复首页样式"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            const trimmed = message.trim();
                                            void onConfirm(
                                                trimmed || null,
                                            ).then((ok) => {
                                                if (ok) {
                                                    state.close();
                                                }
                                            });
                                        }
                                    }}
                                />
                            </TextField>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="tertiary">
                                取消
                            </Button>
                            <Button
                                variant="primary"
                                onPress={() => {
                                    const trimmed = message.trim();
                                    void onConfirm(trimmed || null).then(
                                        (ok) => {
                                            if (ok) {
                                                state.close();
                                            }
                                        },
                                    );
                                }}
                            >
                                保存
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
