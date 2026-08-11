import { toast } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkFile } from "~/lib/api";
import { saveFileContent } from "~/lib/api";
import { LARGE_FILE_BYTES } from "~/lib/editor";

const AUTOSAVE_DELAY_MS = 1000;

const LARGE_FILE_SAVE_DELAY_MS = 5000;
const NO_KEYS: ReadonlySet<string> = new Set<string>();

interface DraftSaverOptions {
    workId: string;
    files: WorkFile[];
    readDraft: (key: string) => string | null;
    replaceDraft: (key: string, content: string) => void;
    loadContent: (key: string) => Promise<string>;
}

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
            const content = readDraft(key);
            if (content === null) {
                return;
            }

            setIsSaving(true);
            try {
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
            const pending = timersRef.current.get(key);
            if (pending) {
                clearTimeout(pending);
            }
            const contentLength = readDraft(key)?.length ?? 0;
            const delay =
                contentLength > LARGE_FILE_BYTES
                    ? LARGE_FILE_SAVE_DELAY_MS
                    : AUTOSAVE_DELAY_MS;
            timersRef.current.set(
                key,
                setTimeout(() => {
                    timersRef.current.delete(key);
                    saveFile(key);
                }, delay),
            );
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
