import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import type { WorkFile } from "~/lib/api";
import {
    createWorkFile,
    deleteFolder,
    deleteWorkFile,
    renameWorkFile,
} from "~/lib/api";

const DUPLICATE_NAME_MESSAGE = "同名文件已存在";
const CREATE_FAILED_MESSAGE = "创建失败，请检查文件名";
const RENAME_FAILED_MESSAGE = "重命名失败，请检查文件名";
const FILE_MISSING_MESSAGE = "文件不存在，可能已被删除";

interface FileActionsOptions {
    workId: string;
    reload: () => Promise<unknown>;
    flushDraft: (key: string) => Promise<void>;
    onFileCreated: (key: string, version: number) => void;
    onFileRemoved: (key: string) => void;
    onFileRenamed: (oldKey: string, newKey: string, version: number) => void;
    onFolderRemoved: (folder: string) => void;
}

/**
 * 文件新建/删除/重命名与文件夹删除。
 * @param options.workId - 作品 ID。
 * @param options.reload - 操作成功后刷新文件列表。
 * @param options.flushDraft - 重命名前把未保存内容先落盘。
 * @param options.onFileCreated - 新建成功回调（携带 key 与版本号）。
 * @param options.onFileRemoved - 删除成功回调。
 * @param options.onFileRenamed - 重命名成功回调（携带新旧 key 与版本号）。
 * @param options.onFolderRemoved - 删除文件夹成功回调。
 * @remarks 内部管理输入态与错误文案。
 */
export function useFileActions({
    workId,
    reload,
    flushDraft,
    onFileCreated,
    onFileRemoved,
    onFileRenamed,
    onFolderRemoved,
}: FileActionsOptions) {
    const [isComposing, setIsComposing] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [renamingFile, setRenamingFile] = useState<WorkFile | null>(null);
    const [renameDraft, setRenameDraft] = useState("");

    const startComposing = useCallback(() => {
        setDraftName("");
        setNameError(null);
        setIsComposing(true);
        setRenamingFile(null);
        setRenameDraft("");
    }, []);

    const cancelComposing = useCallback(() => {
        setIsComposing(false);
        setDraftName("");
        setNameError(null);
    }, []);

    const changeDraftName = useCallback((value: string) => {
        setDraftName(value);
        setNameError(null);
    }, []);

    const confirmComposing = useCallback(async () => {
        const name = draftName.trim();
        if (!name) {
            return;
        }

        const created = await createWorkFile(workId, name);
        if (created.outcome === "duplicate") {
            setNameError(DUPLICATE_NAME_MESSAGE);
            return;
        }
        if (created.outcome === "rejected") {
            setNameError(CREATE_FAILED_MESSAGE);
            return;
        }

        await reload();
        onFileCreated(created.key, created.version);
        cancelComposing();
    }, [workId, draftName, reload, onFileCreated, cancelComposing]);

    const removeFile = useCallback(
        async (file: WorkFile) => {
            try {
                await deleteWorkFile(workId, file.key);
            } catch (error) {
                toast.danger((error as Error).message);
                return;
            }
            onFileRemoved(file.key);
            await reload();
            toast.success("文件已删除");
        },
        [workId, reload, onFileRemoved],
    );

    const startRename = useCallback((file: WorkFile) => {
        setIsComposing(false);
        setDraftName("");
        setRenamingFile(file);
        setRenameDraft(file.name);
        setNameError(null);
    }, []);

    const cancelRename = useCallback(() => {
        setRenamingFile(null);
        setRenameDraft("");
        setNameError(null);
    }, []);

    const changeRenameDraft = useCallback((value: string) => {
        setRenameDraft(value);
        setNameError(null);
    }, []);

    const confirmRename = useCallback(async () => {
        if (!renamingFile) {
            return;
        }
        const newName = renameDraft.trim();
        if (!newName || newName === renamingFile.name) {
            cancelRename();
            return;
        }

        await flushDraft(renamingFile.key);
        const renamed = await renameWorkFile(workId, renamingFile.key, newName);
        if (renamed.outcome === "duplicate") {
            setNameError(DUPLICATE_NAME_MESSAGE);
            return;
        }
        if (renamed.outcome === "missing") {
            toast.danger(FILE_MISSING_MESSAGE);
            cancelRename();
            return;
        }
        if (renamed.outcome === "rejected") {
            setNameError(RENAME_FAILED_MESSAGE);
            return;
        }

        onFileRenamed(renamingFile.key, renamed.key, renamed.version);
        await reload();
        cancelRename();
        toast.success("文件已重命名");
    }, [
        renamingFile,
        renameDraft,
        flushDraft,
        workId,
        onFileRenamed,
        reload,
        cancelRename,
    ]);

    const removeFolder = useCallback(
        async (folder: string) => {
            try {
                await deleteFolder(workId, folder);
            } catch (error) {
                toast.danger((error as Error).message);
                return;
            }
            onFolderRemoved(folder);
            await reload();
            toast.success("文件夹已删除");
        },
        [workId, reload, onFolderRemoved],
    );

    return {
        isComposing,
        draftName,
        nameError,
        startComposing,
        cancelComposing,
        changeDraftName,
        confirmComposing,
        removeFile,
        renamingKey: renamingFile?.key ?? null,
        renameDraft,
        startRename,
        cancelRename,
        changeRenameDraft,
        confirmRename,
        removeFolder,
    };
}
