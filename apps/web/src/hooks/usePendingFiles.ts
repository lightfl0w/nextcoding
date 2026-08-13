import { useCallback, useMemo, useRef, useState } from "react";
import type { CreatedFile, WorkFile } from "~/lib/api";

interface PendingFile {
    key: string;
    name: string;
    content: string;
}

/**
 * 待创建模式下的本地文件注册表。
 * 作品尚未在服务器创建，所有文件只存在浏览器内存里，
 * 待「保存草稿」时一次性批量落盘到新建的作品。
 * @returns 本地文件操作、派生出的 WorkFile 列表与内容读取。
 */
export function usePendingFiles() {
    const [files, setFiles] = useState<PendingFile[]>([]);
    const filesRef = useRef(files);
    filesRef.current = files;

    const hasFiles = files.length > 0;

    const createFile = useCallback(
        (name: string): CreatedFile => {
            const trimmed = name.trim();
            if (!trimmed) {
                return { outcome: "duplicate" };
            }
            if (filesRef.current.some((file) => file.name === trimmed)) {
                return { outcome: "duplicate" };
            }
            const file: PendingFile = {
                key: crypto.randomUUID(),
                name: trimmed,
                content: "",
            };
            setFiles((current) => [...current, file]);
            return { outcome: "created", key: file.key, version: 1 };
        },
        [],
    );

    const renameFile = useCallback(
        (key: string, newName: string): boolean => {
            const trimmed = newName.trim();
            if (!trimmed) {
                return false;
            }
            if (filesRef.current.some((file) => file.name === trimmed)) {
                return false;
            }
            setFiles((current) =>
                current.map((file) =>
                    file.key === key ? { ...file, name: trimmed } : file,
                ),
            );
            return true;
        },
        [],
    );

    const removeFile = useCallback((key: string) => {
        setFiles((current) => current.filter((file) => file.key !== key));
    }, []);

    const removeFolder = useCallback((folder: string) => {
        const prefix = `${folder}/`;
        setFiles((current) =>
            current.filter((file) => !file.name.startsWith(prefix)),
        );
    }, []);

    const readContent = useCallback(
        (key: string) =>
            filesRef.current.find((file) => file.key === key)?.content ??
            null,
        [],
    );

    /** 派生给 FileExplorer / Monaco / 运行使用的文件列表。 */
    const workFiles = useMemo<WorkFile[]>(
        () =>
            files.map((file) => ({
                id: file.key,
                key: file.key,
                name: file.name,
                size: file.content.length,
                contentType: null,
                version: 1,
                createdAt: "",
            })),
        [files],
    );

    return {
        files,
        hasFiles,
        workFiles,
        createFile,
        renameFile,
        removeFile,
        removeFolder,
        readContent,
    };
}
