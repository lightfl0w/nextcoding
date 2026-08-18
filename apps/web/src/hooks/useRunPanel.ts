import { useCallback, useState } from "react";
import { useCodeRunner } from "~/hooks/useCodeRunner";

/**
 * 运行面板共享状态。
 * @remarks 编辑页与详情页共用的「运行中 / 输出 / 开关」。
 */
export function useRunPanel() {
    const {
        running,
        output,
        result,
        run,
        clear,
        awaitingInput,
        submitInput,
        cancelInput,
        mode,
        terminalId,
        canvasId,
        stop,
        loadStage,
        loopHint,
    } = useCodeRunner();
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const openPanel = useCallback(() => setIsPanelOpen(true), []);
    const closePanel = useCallback(() => {
        setIsPanelOpen(false);

        if (mode === "pygame") {
            stop();
        }
    }, [mode, stop]);

    return {
        running,
        output,
        result,
        run,
        clear,
        awaitingInput,
        submitInput,
        cancelInput,
        mode,
        terminalId,
        canvasId,
        stop,
        loadStage,
        loopHint,
        isPanelOpen,
        openPanel,
        closePanel,
    };
}
