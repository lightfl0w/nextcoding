import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkFile } from "~/lib/api";

const NO_KEYS: ReadonlySet<string> = new Set<string>();

/**
 * 编辑器标签页。
 * @param files - 当前文件列表。
 * @returns 激活项与打开集合。
 * @remarks 文件列表变动时自动打开新出现的文件。
 */
export function useFileTabs(files: WorkFile[]) {
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(NO_KEYS);

    const filesRef = useRef(files);
    filesRef.current = files;
    const openKeysRef = useRef(openKeys);
    openKeysRef.current = openKeys;
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;
    const autoOpenedRef = useRef(new Set<string>());

    useEffect(() => {
        if (files.length === 0) {
            return;
        }
        setActiveKey((current) =>
            current && files.some((file) => file.key === current)
                ? current
                : files[0].key,
        );
    }, [files]);

    useEffect(() => {
        setOpenKeys((current) =>
            reconcileOpenKeys(current, files, autoOpenedRef.current),
        );
    }, [files]);

    const selectFile = useCallback((key: string) => setActiveKey(key), []);

    const openFile = useCallback((key: string) => {
        setOpenKeys((current) => new Set(current).add(key));
        setActiveKey(key);
    }, []);

    const closeFile = useCallback((key: string) => {
        const remaining = new Set(openKeysRef.current);
        remaining.delete(key);
        setOpenKeys(remaining);

        if (activeKeyRef.current !== key) {
            return;
        }
        const fallback = filesRef.current.find(
            (file) => file.key !== key && remaining.has(file.key),
        );
        setActiveKey(fallback?.key ?? null);
    }, []);

    return { activeKey, openKeys, selectFile, openFile, closeFile };
}

function reconcileOpenKeys(
    current: ReadonlySet<string>,
    files: WorkFile[],
    autoOpened: Set<string>,
): ReadonlySet<string> {
    const next = new Set<string>();

    for (const file of files) {
        if (current.has(file.key)) {
            next.add(file.key);
            continue;
        }
        if (!autoOpened.has(file.key)) {
            autoOpened.add(file.key);
            next.add(file.key);
        }
    }

    return hasSameKeys(current, next) ? current : next;
}

function hasSameKeys(
    current: ReadonlySet<string>,
    next: ReadonlySet<string>,
): boolean {
    if (current.size !== next.size) {
        return false;
    }
    for (const key of next) {
        if (!current.has(key)) {
            return false;
        }
    }
    return true;
}
