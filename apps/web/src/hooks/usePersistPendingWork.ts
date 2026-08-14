import { toast } from "@heroui/react";
import { useCallback, useRef } from "react";
import {
    createWork,
    createWorkFile,
    publishVersion,
    saveFileContent,
} from "~/lib/api";

interface PersistPendingWorkOptions {
    title: string;
    files: ReadonlyArray<{ key: string; name: string }>;
    readDraft: (key: string) => string | null;
}

/**
 * 待创建模式下把浏览器内存文件持久化为新作品。
 * @param options.title - 作品标题。
 * @param options.files - 待创建的文件列表。
 * @param options.readDraft - 读取文件草稿内容。
 * @returns 持久化函数与进行中标记。
 * @remarks 失败时提示并返回 `null`；`persistingRef` 供离开确认使用。
 */
export function usePersistPendingWork({
    title,
    files,
    readDraft,
}: PersistPendingWorkOptions) {
    const persistingRef = useRef(false);

    const persist = useCallback(
        async (message: string | null): Promise<string | null> => {
            persistingRef.current = true;
            try {
                const { id } = await createWork(title.trim() || "未命名作品");
                for (const file of files) {
                    const content = readDraft(file.key) ?? "";
                    const created = await createWorkFile(id, file.name);
                    if (created.outcome !== "created") {
                        throw new Error(`创建文件失败：${file.name}`);
                    }
                    await saveFileContent(
                        id,
                        created.key,
                        content,
                        created.version,
                    );
                }
                if (message !== null) {
                    await publishVersion(id, message);
                }
                return id;
            } catch (error) {
                persistingRef.current = false;
                toast.danger((error as Error).message);
                return null;
            }
        },
        [title, files, readDraft],
    );

    return { persist, persistingRef };
}
