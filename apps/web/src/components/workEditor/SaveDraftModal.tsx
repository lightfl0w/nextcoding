import {
    Button,
    Input,
    Label,
    Modal,
    TextField,
    type useOverlayState,
} from "@heroui/react";
import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";

interface SaveDraftModalProps {
    state: ReturnType<typeof useOverlayState>;
    isSaving: boolean;
    onConfirm: (message: string) => void;
}

/**
 * 保存草稿弹窗。
 * @param props.state - 弹窗开关状态。
 * @param props.isSaving - 保存中时禁用按钮。
 * @param props.onConfirm - 确认回调，携带版本说明。
 * @remarks 每次打开时清空上次输入的版本说明。
 */
export function SaveDraftModal({
    state,
    isSaving,
    onConfirm,
}: SaveDraftModalProps) {
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (state.isOpen) {
            setMessage("");
        }
    }, [state.isOpen]);

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[420px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading className="flex items-center gap-2">
                                <Bookmark className="size-4" />
                                保存草稿
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <p className="text-sm text-foreground/60">
                                将当前代码保存为一个版本快照，可随时在右侧版本历史中对比或回滚。
                            </p>
                            <TextField
                                className="flex flex-col gap-1.5"
                                value={message}
                                onChange={setMessage}
                            >
                                <Label className="text-xs text-foreground/60">
                                    版本说明（可选）
                                </Label>
                                <Input
                                    placeholder="例如：修复首页样式"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            state.close();
                                            onConfirm(message);
                                        }
                                    }}
                                />
                            </TextField>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                slot="close"
                                variant="tertiary"
                                isDisabled={isSaving}
                            >
                                取消
                            </Button>
                            <Button
                                slot="close"
                                variant="primary"
                                isDisabled={isSaving}
                                onPress={() => onConfirm(message)}
                            >
                                <Bookmark className="size-3.5" />
                                保存草稿
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
