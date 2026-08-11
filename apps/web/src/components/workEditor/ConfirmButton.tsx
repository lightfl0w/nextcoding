import { AlertDialog, Button } from "@heroui/react";
import type { ReactNode } from "react";

interface ConfirmButtonProps {
    trigger: ReactNode;
    heading: ReactNode;
    description: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
}

export function ConfirmButton({
    trigger,
    heading,
    description,
    confirmLabel,
    onConfirm,
}: ConfirmButtonProps) {
    return (
        <AlertDialog>
            {trigger}
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-[400px]">
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>{heading}</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>{description}</p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">
                                取消
                            </Button>
                            <Button
                                slot="close"
                                variant="danger"
                                onPress={onConfirm}
                            >
                                {confirmLabel}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
