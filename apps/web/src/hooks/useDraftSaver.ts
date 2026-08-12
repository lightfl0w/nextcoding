import { toast } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkFile } from "~/lib/api";
import { saveFileContent } from "~/lib/api";
import { LARGE_FILE_BYTES } from "~/lib/editor";

const AUTOSAVE_DELAY_MS = 1000;

const LARGE_FILE_SAVE_DELAY_MS = 5000;
const NO_KEYS: ReadonlySet<string> = new Set<string>();

/** 定时器映射的引用容器。 */
interface TimerMapRef {
    current: Map<string, ReturnType<typeof setTimeout>>;
}

/**
 * 防抖保存延迟。
 * @param contentLength - 文件内容长度。
 * @returns 大文件用更长延迟，避免频繁提交。
 */
function saveDelayMs(contentLength: number): number {
    if (contentLength > LARGE_FILE_BYTES) {
        return LARGE_FILE_SAVE_DELAY_MS;
    }
    return AUTOSAVE_DELAY_MS;
}

/**
 * 安排或重置某文件的防抖定时器。
 * @param timersRef - 定时器映射。
 * @param key - 文件键。
 * @param delay - 延迟毫秒数。
 * @param onFire - 到点回调。
 */
function scheduleTimer(
    timersRef: TimerMapRef,
    key: string,
    delay: number,
    onFire: () => void,
): void {
    const pending = timersRef.current.get(key);
    if (pending) {
        clearTimeout(pending);
    }
    timersRef.current.set(
        key,
        setTimeout(() => {
            timersRef.current.delete(key);
            onFire();
        }, delay),
    );
}

interface DraftSaverOptions {
    workId: string;
    files: WorkFile[];
    readDraft: (key: string) => string | null;
    replaceDraft: (key: string, content: string) => void;
    loadContent: (key: string) => Promise<string>;
}

/**
 * 自动保存。
 * @param options.workId - 作品 ID。
 * @param options.readDraft - 读取某文件的草稿内容。
 * @param options.loadContent - 从服务器加载文件内容。
 * @remarks 内容变化防抖提交；版本冲突时拉服务器内容覆盖草稿。
 */
export function useDraftSaver({
    workId,
    files,
    readDraft,
    replaceDraft,
    loadContent,
}: DraftSaverOptions) {
    const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<string>>(NO_KEYS);
    const [isSaving, setIsSaving] = useState(false);
    const versionsRef = useRef(new Map<string, number>());
    const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        for (const file of files) {
            versionsRef.current.set(file.key, file.version ?? 1);
        }
    }, [files]);

    useEffect(
        () => () => {
            for (const timer of timersRef.current.values()) {
                clearTimeout(timer);
            }
            timersRef.current.clear();
        },
        [],
    );

    const markSaved = useCallback((key: string) => {
        setDirtyKeys((current) => {
            if (!current.has(key)) {
                return current;
            }
            const next = new Set(current);
            next.delete(key);
            return next;
        });
    }, []);

    const saveFile = useCallback(
        async (key: string) => {
            setIsSaving(true);
            try {
                const content = readDraft(key);
                if (content === null) {
                    return;
                }

                const saved = await saveFileContent(
                    workId,
                    key,
                    content,
                    versionsRef.current.get(key) ?? 1,
                );
                if (saved.outcome === "conflict") {
                    versionsRef.current.set(key, saved.currentVersion);
                    replaceDraft(key, await loadContent(key));
                } else {
                    versionsRef.current.set(key, saved.version);
                }
                markSaved(key);
            } catch (error) {
                toast.danger((error as Error).message);
            } finally {
                setIsSaving(false);
            }
        },
        [workId, readDraft, replaceDraft, loadContent, markSaved],
    );

    const scheduleSave = useCallback(
        (key: string) => {
            setDirtyKeys((current) =>
                current.has(key) ? current : new Set(current).add(key),
            );
            const delay = saveDelayMs(readDraft(key)?.length ?? 0);
            scheduleTimer(timersRef, key, delay, () => {
                void saveFile(key);
            });
        },
        [saveFile, readDraft],
    );

    const trackFile = useCallback((key: string, version: number) => {
        versionsRef.current.set(key, version);
    }, []);

    const forgetFile = useCallback(
        (key: string) => {
            versionsRef.current.delete(key);
            markSaved(key);
        },
        [markSaved],
    );

    return { dirtyKeys, isSaving, scheduleSave, trackFile, forgetFile };
}
