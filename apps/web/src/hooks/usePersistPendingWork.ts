import { toast } from "@heroui/react";
import { useCallback, useRef } from "react";
import { commitWorkTree, createWork } from "~/lib/api";

interface PersistPendingWorkOptions {
    title: string;
    files: ReadonlyArray<{ key: string; name: string }>;
    readDraft: (key: string) => string | null;
    /**
     * 备选内容源。草稿（Monaco 模型）尚未建立时回退到这里，
     * 避免未打开过的文件被写成空内容。
     */
    readContent?: (key: string) => string | null;
}

/**
 * 待创建模式下把浏览器内存文件持久化为新作品。
 * @param options.title - 作品标题。
 * @param options.files - 待创建的文件列表。
 * @param options.readDraft - 读取文件草稿内容。
 * @returns 持久化函数与进行中标记。
 * @remarks 创建作品后一次性整树提交，避免逐文件上传；
 * 失败时提示并返回 `null`；`persistingRef` 供离开确认使用。
 */
export function usePersistPendingWork({
    title,
    files,
    readDraft,
    readContent,
}: PersistPendingWorkOptions) {
    const persistingRef = useRef(false);

    const persist = useCallback(
        async (message: string | null): Promise<string | null> => {
            persistingRef.current = true;
            try {
                const { id } = await createWork(title.trim() || "未命名作品");
                const tree = Object.fromEntries(
                    files.map((file) => [
                        file.name,
                        readDraft(file.key) ?? readContent?.(file.key) ?? "",
                    ]),
                );
                const committed = await commitWorkTree(id, tree, { message });
                if (committed.outcome === "conflict") {
                    throw new Error("作品刚被更新，请重试");
                }
                return id;
            } catch (error) {
                persistingRef.current = false;
                toast.danger((error as Error).message);
                return null;
            }
        },
        [title, files, readDraft, readContent],
    );

    return { persist, persistingRef };
}
