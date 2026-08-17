import { Button, Modal, TextArea, toast, useOverlayState } from "@heroui/react";
import { Flag } from "lucide-react";
import { useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { reportWork } from "~/lib/api/reports";

const REASON_PRESETS = [
    "违规内容",
    "抄袭或侵权",
    "垃圾广告",
    "色情低俗",
    "恶意攻击",
];

/**
 * 举报作品按钮：点击弹出原因填写弹窗，提交后进入后台待处理队列。
 */
export function ReportButton({ workId }: { workId: string }) {
    const { isLoggedIn } = useAuth();
    const state = useOverlayState();
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleOpen = () => {
        if (!isLoggedIn) {
            toast.warning("请先登录后再举报");
            return;
        }
        state.open();
    };

    const handleClose = () => {
        state.close();
        setReason("");
    };

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toast.warning("请填写举报原因");
            return;
        }
        setIsSubmitting(true);
        try {
            await reportWork(workId, reason.trim().slice(0, 200));
            toast.success("举报已提交，我们会尽快处理");
            handleClose();
        } catch (err) {
            toast.danger((err as Error).message || "举报提交失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                className="gap-2 shrink-0"
                aria-label="举报作品"
                onPress={handleOpen}
            >
                <Flag className="size-4" />
                举报
            </Button>

            <Modal state={state}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[420px]">
                            <Modal.CloseTrigger onPress={handleClose} />
                            <Modal.Header>
                                <Modal.Heading>举报作品</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <p className="text-sm text-foreground/70">
                                    请选择或填写举报原因，我们会尽快核实处理。
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {REASON_PRESETS.map((preset) => (
                                        <Button
                                            key={preset}
                                            size="sm"
                                            variant={
                                                reason === preset
                                                    ? "primary"
                                                    : "secondary"
                                            }
                                            onPress={() => setReason(preset)}
                                        >
                                            {preset}
                                        </Button>
                                    ))}
                                </div>
                                <TextArea
                                    aria-label="举报原因"
                                    placeholder="补充说明（200 字以内）…"
                                    maxLength={200}
                                    value={reason}
                                    onChange={(value) =>
                                        setReason(String(value))
                                    }
                                />
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    variant="tertiary"
                                    onPress={handleClose}
                                >
                                    取消
                                </Button>
                                <Button
                                    variant="danger"
                                    isDisabled={isSubmitting || !reason.trim()}
                                    onPress={handleSubmit}
                                >
                                    {isSubmitting ? "提交中…" : "提交举报"}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </>
    );
}
