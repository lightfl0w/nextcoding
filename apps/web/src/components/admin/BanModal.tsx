import {
    Button,
    FieldError,
    Input,
    Label,
    Modal,
    Spinner,
    TextField,
    toast,
    type useOverlayState,
} from "@heroui/react";
import { useState } from "react";
import type { AdminUser } from "~/lib/api/admin";

const MAX_HOURS = 24 * 365;

interface BanModalProps {
    state: ReturnType<typeof useOverlayState>;
    user: AdminUser | null;
    onConfirm: (reason: string, hours?: number) => Promise<void>;
}

/**
 * 封禁用户弹窗：填写原因与可选时长（小时，留空为永久封禁）。
 */
export function BanModal({ state, user, onConfirm }: BanModalProps) {
    const [reason, setReason] = useState("");
    const [hours, setHours] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hoursError, setHoursError] = useState<string | null>(null);

    if (!user) {
        return null;
    }

    const handleConfirm = async () => {
        let parsedHours: number | undefined;
        if (hours.trim() !== "") {
            const value = Number(hours);
            if (!Number.isFinite(value) || value <= 0) {
                setHoursError("请输入大于 0 的时长");
                return;
            }
            parsedHours = Math.min(Math.floor(value), MAX_HOURS);
        }
        setHoursError(null);
        setIsSubmitting(true);
        try {
            await onConfirm(reason.trim(), parsedHours);
            toast.success("已封禁该用户");
            state.close();
            setReason("");
            setHours("");
        } catch (err) {
            toast.danger((err as Error).message || "封禁失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        state.close();
        setReason("");
        setHours("");
        setHoursError(null);
    };

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[420px]">
                        <Modal.CloseTrigger onPress={handleClose} />
                        <Modal.Header>
                            <Modal.Heading>封禁用户</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <p className="text-sm text-foreground/70">
                                封禁后该用户将无法登录，其已发布内容不会被删除。
                            </p>
                            <div className="flex flex-col gap-1.5">
                                <Label>用户</Label>
                                <Input
                                    readOnly
                                    value={`${user.name ?? "未命名"}（${user.email}）`}
                                />
                            </div>
                            <TextField
                                value={reason}
                                onChange={(value) => setReason(String(value))}
                            >
                                <Label>封禁原因（可选）</Label>
                                <Input
                                    placeholder="如：发布违规内容"
                                    maxLength={200}
                                />
                            </TextField>
                            <div className="flex flex-col gap-1.5">
                                <Label>封禁时长（小时，可选）</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={MAX_HOURS}
                                    placeholder="留空则永久封禁"
                                    value={hours}
                                    onChange={(event) =>
                                        setHours(event.target.value)
                                    }
                                />
                                {hoursError && (
                                    <FieldError>{hoursError}</FieldError>
                                )}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="tertiary" onPress={handleClose}>
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
                                {isSubmitting ? "封禁中…" : "确认封禁"}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
