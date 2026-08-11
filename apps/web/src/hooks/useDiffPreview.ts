import { toast } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "~/hooks/useSnapshot";

export interface DiffPreview {
    version: number;
    original: string;
    modified: string;
}

interface DiffPreviewOptions {
    workId: string;
    activeKey: string | null;
    readDraft: (key: string) => string | null;
}

/**
 * 版本对比。
 * @param options.workId - 作品 ID。
 * @param options.activeKey - 当前打开的文件 key。
 * @param options.readDraft - 读取某文件的草稿内容。
 * @remarks 对比的是快照里的原始内容与当前草稿。
 */
export function useDiffPreview({
    workId,
    activeKey,
    readDraft,
}: DiffPreviewOptions) {
    const [preview, setPreview] = useState<DiffPreview | null>(null);
    const [previewVersion, setPreviewVersion] = useState<number | null>(null);
    const { data: snapshot, error } = useSnapshot(workId, previewVersion);

    const close = useCallback(() => {
        setPreviewVersion(null);
        setPreview(null);
    }, []);

    const compareWith = useCallback(
        (version: number) => {
            if (!activeKey) {
                toast.warning("请先打开一个文件再对比");
                return;
            }
            setPreview(null);
            setPreviewVersion(version);
        },
        [activeKey],
    );

    useEffect(() => {
        if (previewVersion === null) {
            return;
        }
        if (error) {
            toast.danger("版本快照加载失败");
            close();
            return;
        }
        if (!snapshot) {
            return;
        }
        if (!activeKey) {
            close();
            return;
        }
        const file = snapshot.files.find(
            (candidate) => candidate.key === activeKey,
        );
        if (!file) {
            toast.warning(`v${previewVersion} 中不存在当前文件`);
            close();
            return;
        }
        setPreview({
            version: previewVersion,
            original: file.content ?? "",
            modified: readDraft(activeKey) ?? "",
        });
    }, [previewVersion, snapshot, error, activeKey, readDraft, close]);

    return { preview, compareWith, close };
}
