import {
    Button,
    Input,
    Label,
    Modal,
    Spinner,
    TextField,
    toast,
    type useOverlayState,
} from "@heroui/react";
import { GitPullRequest, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { pushWorkToGit } from "~/lib/api/git";

interface PushToRemoteDialogProps {
    state: ReturnType<typeof useOverlayState>;
    workId: string;
}

/**
 * 把作品版本历史推送到远程 Git 仓库。
 * @param props.state - 弹窗开关状态。
 * @param props.workId - 作品 ID。
 * @remarks 令牌仅发送到本服务端用于本次推送，不在浏览器持久化。
 */
export function PushToRemoteDialog({ state, workId }: PushToRemoteDialogProps) {
    const [url, setUrl] = useState("");
    const [token, setToken] = useState("");
    const [ref, setRef] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state.isOpen) {
            setUrl("");
            setToken("");
            setRef("");
            setError(null);
        }
    }, [state.isOpen]);

    const submit = async () => {
        if (isSubmitting) {
            return;
        }
        if (!url.trim() || !token.trim()) {
            setError("请输入远程仓库地址和访问令牌");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await pushWorkToGit(workId, {
                url: url.trim(),
                token: token.trim(),
                ref: ref.trim() || undefined,
            });
            toast.success(
                `已推送 ${result.commitCount} 个提交到 ${result.pushedRef}`,
            );
            state.close();
        } catch (err) {
            setError((err as Error).message || "推送失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[440px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading className="flex items-center gap-2">
                                <GitPullRequest className="size-4" />
                                推送远程仓库
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <p className="text-sm text-foreground/60">
                                作品的全部版本历史将转换为 Git
                                提交，推送到你提供的远程仓库。
                            </p>
                            <TextField
                                className="flex flex-col gap-1.5"
                                value={url}
                                onChange={setUrl}
                            >
                                <Label className="text-xs text-foreground/60">
                                    远程仓库地址
                                    <span className="text-danger"> *</span>
                                </Label>
                                <Input
                                    placeholder="https://github.com/user/repo.git"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void submit();
                                        }
                                    }}
                                />
                            </TextField>
                            <TextField
                                className="flex flex-col gap-1.5"
                                value={token}
                                onChange={setToken}
                            >
                                <Label className="text-xs text-foreground/60">
                                    访问令牌
                                    <span className="text-danger"> *</span>
                                </Label>
                                <Input
                                    type="password"
                                    placeholder="Personal Access Token"
                                />
                            </TextField>
                            <TextField
                                className="flex flex-col gap-1.5"
                                value={ref}
                                onChange={setRef}
                            >
                                <Label className="text-xs text-foreground/60">
                                    目标分支（可选）
                                </Label>
                                <Input placeholder="缺省推送当前分支" />
                            </TextField>
                            {error && (
                                <p className="text-xs text-danger">{error}</p>
                            )}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                slot="close"
                                variant="tertiary"
                                isDisabled={isSubmitting}
                            >
                                取消
                            </Button>
                            <Button
                                variant="primary"
                                isDisabled={isSubmitting}
                                onPress={() => void submit()}
                            >
                                {isSubmitting ? (
                                    <Spinner size="sm" className="size-4" />
                                ) : (
                                    <Upload className="size-3.5" />
                                )}
                                {isSubmitting ? "推送中…" : "推送"}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
