import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import type { WorkFile } from "~/lib/api";
import { createWorkFile, deleteWorkFile } from "~/lib/api";

const DUPLICATE_NAME_MESSAGE = "同名文件已存在";
const CREATE_FAILED_MESSAGE = "创建失败，请检查文件名";

interface FileActionsOptions {
    workId: string;
    reload: () => Promise<unknown>;
    onFileCreated: (key: string, version: number) => void;
    onFileRemoved: (key: string) => void;
}

export function useFileActions({
    workId,
    reload,
    onFileCreated,
    onFileRemoved,
}: FileActionsOptions) {
    const [isComposing, setIsComposing] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);

    const startComposing = useCallback(() => {
        setDraftName("");
        setNameError(null);
        setIsComposing(true);
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
        if (!name) return;

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

    return {
        isComposing,
        draftName,
        nameError,
        startComposing,
        cancelComposing,
        changeDraftName,
        confirmComposing,
        removeFile,
    };
}
