import { useCallback, useState } from "react";
import { useCodeRunner } from "~/hooks/useCodeRunner";

export function useRunPanel() {
    const { running, output, result, run, clear } = useCodeRunner();
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const openPanel = useCallback(() => setIsPanelOpen(true), []);
    const closePanel = useCallback(() => setIsPanelOpen(false), []);

    return {
        running,
        output,
        result,
        run,
        clear,
        isPanelOpen,
        openPanel,
        closePanel,
    };
}
