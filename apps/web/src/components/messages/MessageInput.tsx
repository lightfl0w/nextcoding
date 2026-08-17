import { Button, Spinner } from "@heroui/react";
import { Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const MAX_LENGTH = 1000;
const MAX_HEIGHT = 120;

export function MessageInput({
    onSend,
    disabled,
}: {
    onSend: (content: string) => Promise<void> | void;
    disabled?: boolean;
}) {
    const [value, setValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const canSend = value.trim().length > 0 && !isSending && !disabled;

    const resize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) {
            return;
        }
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }, []);

    const handleSend = useCallback(async () => {
        const trimmed = value.trim();
        if (!trimmed || isSending || disabled) {
            return;
        }
        setIsSending(true);
        try {
            await onSend(trimmed);
        } finally {
            setIsSending(false);
        }
        setValue("");
        requestAnimationFrame(resize);
        textareaRef.current?.focus();
    }, [value, isSending, disabled, onSend, resize]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    return (
        <div className="flex shrink-0 items-end gap-2 border-t border-default-200/70 bg-background px-3 py-2.5">
            <textarea
                ref={textareaRef}
                value={value}
                name="message"
                onChange={(e) => {
                    setValue(e.target.value);
                    resize();
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={MAX_LENGTH}
                placeholder="输入消息…"
                aria-label="消息内容"
                autoComplete="off"
                disabled={disabled}
                className="flex-1 min-w-0 resize-none rounded-xl border border-default-200 bg-default-50 px-3.5 py-2 text-sm leading-relaxed text-foreground placeholder:text-foreground/35 transition-colors focus:border-primary/50 focus:outline-none disabled:opacity-60"
            />
            <Button
                isIconOnly
                variant="primary"
                isDisabled={!canSend}
                onPress={handleSend}
                aria-label="发送消息"
                className="size-10 shrink-0 rounded-xl touch-manipulation"
            >
                {isSending ? (
                    <Spinner size="sm" className="size-4" />
                ) : (
                    <Send className="size-4" />
                )}
            </Button>
        </div>
    );
}
