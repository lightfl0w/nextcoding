import { toast } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useRunPanel } from "~/hooks/useRunPanel";
import { useSnapshot } from "~/hooks/useSnapshot";
import type { WorkFile, WorkVersion } from "~/lib/api";
import { fileContentPath, readFileContent } from "~/lib/api";
import {
    detectRuntime,
    languageLabel,
    type RunnableFile,
    type RuntimeInfo,
    toSources,
    unsupportedRuntimeMessage,
} from "~/lib/run";

/**
 * 详情页运行。
 * @param workId - 作品 ID。
 * @param runtime - 检测到的运行时；为 `null` 表示不可运行。
 * @remarks 支持运行当前版本与历史版本快照。
 */
export function useWorkRunner(workId: string, runtime: RuntimeInfo | null) {
    const {
        running,
        output,
        result,
        run,
        clear,
        isPanelOpen,
        openPanel,
        closePanel,
        awaitingInput,
        submitInput,
        cancelInput,
    } = useRunPanel();
    const { mutate } = useSWRConfig();
    const [activeVersion, setActiveVersion] = useState<number | null>(null);
    const [label, setLabel] = useState<string | null>(null);
    const [pendingVersion, setPendingVersion] = useState<number | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const { data: pendingSnapshot, error: pendingError } = useSnapshot(
        workId,
        pendingVersion,
    );

    const execute = useCallback(
        async (
            files: RunnableFile[],
            selectedRuntime: RuntimeInfo,
            version: number | null,
        ) => {
            setActiveVersion(version);
            setLabel(runLabel(selectedRuntime, version));
            openPanel();
            requestAnimationFrame(() =>
                panelRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                }),
            );

            await run(
                toSources(files),
                selectedRuntime.entryPoint,
                selectedRuntime.language,
            );
        },
        [run, openPanel],
    );

    const runCurrent = useCallback(
        async (files: WorkFile[]) => {
            if (!runtime) {
                toast.warning(
                    unsupportedRuntimeMessage(files.map((file) => file.name)),
                );
                return;
            }
            const loaded = await Promise.all(
                files.map(async (file) => ({
                    name: file.name,
                    content:
                        (await mutate(fileContentPath(workId, file.key), () =>
                            readFileContent(workId, file.key),
                        )) ?? "",
                })),
            );
            await execute(loaded, runtime, null);
        },
        [workId, runtime, execute, mutate],
    );

    const runVersion = useCallback((version: WorkVersion) => {
        setPendingVersion(version.version);
    }, []);

    useEffect(() => {
        if (pendingVersion === null) {
            return;
        }
        if (pendingError) {
            toast.danger("版本快照加载失败");
            setPendingVersion(null);
            return;
        }
        if (!pendingSnapshot) {
            return;
        }

        const files: RunnableFile[] = pendingSnapshot.files
            .filter((file) => file.encoding !== "base64")
            .map((file) => ({ name: file.name, content: file.content }));

        const snapshotRuntime = detectRuntime(files.map((file) => file.name));
        if (!snapshotRuntime) {
            toast.warning(
                unsupportedRuntimeMessage(
                    files.map((file) => file.name),
                    "该版本没有可运行的文本文件",
                ),
            );
            setPendingVersion(null);
            return;
        }

        execute(files, snapshotRuntime, pendingVersion);
        setPendingVersion(null);
    }, [pendingVersion, pendingSnapshot, pendingError, execute]);

    return {
        running,
        output,
        result,
        clear,
        isPanelOpen,
        closePanel,
        activeVersion,
        label,
        panelRef,
        runCurrent,
        runVersion,
        awaitingInput,
        submitInput,
        cancelInput,
    };
}

function runLabel(runtime: RuntimeInfo, version: number | null): string {
    const language = languageLabel(runtime.language);
    return version === null ? language : `v${version} ${language}`;
}
