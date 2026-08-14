import { Button, Input } from "@heroui/react";
import { Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface MessageInputProps {
    onSend: (content: string) => void;
    disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled) {
            return;
        }
        onSend(trimmed);
        setValue("");
        inputRef.current?.focus();
    }, [value, disabled, onSend]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    return (
        <div className="flex items-end gap-2 px-4 py-3 border-t border-default-200/70">
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息…"
                maxLength={1000}
                disabled={disabled}
                className="text-sm"
            />
            <Button
                isIconOnly
                variant="primary"
                onPress={handleSend}
                isDisabled={!value.trim() || disabled}
                className="rounded-xl shrink-0"
                aria-label="发送消息"
            >
                <Send className="size-4" />
            </Button>
        </div>
    );
}
