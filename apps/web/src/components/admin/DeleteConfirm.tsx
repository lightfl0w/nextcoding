import {
    AlertDialog,
    Button,
    Spinner,
    toast,
    type useOverlayState,
} from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";

interface DeleteConfirmProps {
    state: ReturnType<typeof useOverlayState>;
    heading: ReactNode;
    description: ReactNode;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
}

/**
 * 受控删除确认弹窗：danger 语义，执行中禁用按钮并展示加载态，
 * 失败时保持弹窗并提示错误。
 */
export function DeleteConfirm({
    state,
    heading,
    description,
    confirmLabel,
    onConfirm,
}: DeleteConfirmProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (isSubmitting) {
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirm();
            toast.success("操作成功");
            state.close();
        } catch (err) {
            toast.danger((err as Error).message || "操作失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AlertDialog.Backdrop
            isOpen={state.isOpen}
            onOpenChange={state.setOpen}
        >
            <AlertDialog.Container>
                <AlertDialog.Dialog className="sm:max-w-[400px]">
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                        <AlertDialog.Icon status="danger" />
                        <AlertDialog.Heading>{heading}</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                        <p className="text-sm text-foreground/70">
                            {description}
                        </p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                        <Button
                            slot="close"
                            variant="tertiary"
                            isDisabled={isSubmitting}
                        >
                            取消
                        </Button>
                        <Button
                            variant="danger"
                            isDisabled={isSubmitting}
                            onPress={handleConfirm}
                        >
                            {isSubmitting ? (
                                <Spinner size="sm" className="size-4" />
                            ) : null}
                            {isSubmitting ? "处理中…" : confirmLabel}
                        </Button>
                    </AlertDialog.Footer>
                </AlertDialog.Dialog>
            </AlertDialog.Container>
        </AlertDialog.Backdrop>
    );
}
