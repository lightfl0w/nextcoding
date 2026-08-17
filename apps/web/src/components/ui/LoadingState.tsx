import { Spinner } from "@heroui/react";

/**
 * 通用加载态：居中 spinner + 文案。
 * @param text - 加载文案，默认「正在加载…」。
 */
export function LoadingState({ text = "正在加载…" }: { text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground/40">
            <Spinner size="sm" />
            <span className="text-sm">{text}</span>
        </div>
    );
}
