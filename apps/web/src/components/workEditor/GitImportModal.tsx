import {
    Button,
    Chip,
    Input,
    Label,
    Modal,
    TextField,
    type useOverlayState,
} from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, GitPullRequest } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    cancelGitImport,
    cancelGitImportOnUnload,
    type GitImportJobEvent,
    type GitImportResult,
    gitImportJobEventsUrl,
    startGitImport,
} from "~/lib/api/git";

interface GitImportModalProps {
    state: ReturnType<typeof useOverlayState>;
}

/**
 * 从 Git 仓库导入作品（异步任务 + SSE 实时进度）。
 * @param props.state - 弹窗开关状态。
 * @remarks 启动后订阅进度事件流：显示阶段进度；完成展示统计与被跳过的文件；失败展示具体原因。
 * 可主动取消；页面关闭或组件卸载时自动取消后台任务。
 */
export function GitImportModal({ state }: GitImportModalProps) {
    const navigate = useNavigate();
    const [repoUrl, setRepoUrl] = useState("");
    const [ref, setRef] = useState("");
    const [title, setTitle] = useState("");
    const [depth, setDepth] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{
        percent: number;
        message: string;
    } | null>(null);
    const [result, setResult] = useState<GitImportResult | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const activeJobIdRef = useRef<string | null>(null);

    const clearActiveJob = () => {
        activeJobIdRef.current = null;
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
    };

    useEffect(() => {
        const cancelOnUnload = () => {
            const jobId = activeJobIdRef.current;
            if (jobId) {
                cancelGitImportOnUnload(jobId);
            }
        };
        window.addEventListener("pagehide", cancelOnUnload);
        window.addEventListener("beforeunload", cancelOnUnload);
        return () => {
            window.removeEventListener("pagehide", cancelOnUnload);
            window.removeEventListener("beforeunload", cancelOnUnload);
            cancelOnUnload();
        };
    }, []);

    useEffect(() => {
        if (state.isOpen) {
            setRepoUrl("");
            setRef("");
            setTitle("");
            setDepth("");
            setError(null);
            setProgress(null);
            setResult(null);
            setIsCancelling(false);
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
        }
    }, [state.isOpen]);

    const subscribe = (jobId: string) => {
        activeJobIdRef.current = jobId;
        const es = new EventSource(gitImportJobEventsUrl(jobId));
        eventSourceRef.current = es;

        es.addEventListener("progress", (event) => {
            const data = parseEvent(event);
            if (!data) {
                return;
            }
            setProgress({ percent: data.percent, message: data.message });
        });

        es.addEventListener("done", (event) => {
            const data = parseEvent(event);
            clearActiveJob();
            setIsSubmitting(false);
            setIsCancelling(false);
            if (data?.result) {
                setResult(data.result);
            } else {
                setError("导入完成但缺少结果数据");
            }
        });

        es.addEventListener("cancelled", () => {
            clearActiveJob();
            setIsSubmitting(false);
            setIsCancelling(false);
            setProgress(null);
            setError("导入已取消");
        });

        es.addEventListener("error", (event) => {
            const data = parseEvent(event);
            clearActiveJob();
            setIsSubmitting(false);
            setIsCancelling(false);
            setError(data?.error ?? data?.message ?? "连接进度服务失败");
        });
    };

    const submit = async () => {
        if (isSubmitting) {
            return;
        }
        const trimmedUrl = repoUrl.trim();
        if (!trimmedUrl) {
            setError("请输入仓库地址");
            return;
        }
        const depthNumber =
            depth.trim() === "" ? undefined : Number(depth.trim());
        setIsSubmitting(true);
        setError(null);
        setProgress(null);
        try {
            const { jobId } = await startGitImport({
                repoUrl: trimmedUrl,
                ref: ref.trim() || undefined,
                title: title.trim() || undefined,
                depth:
                    Number.isInteger(depthNumber) &&
                    (depthNumber as number) >= 1
                        ? (depthNumber as number)
                        : undefined,
            });
            subscribe(jobId);
        } catch (err) {
            setIsSubmitting(false);
            setError((err as Error).message || "导入失败，请重试");
        }
    };

    const cancelImport = async () => {
        const jobId = activeJobIdRef.current;
        if (!jobId || isCancelling) {
            return;
        }
        setIsCancelling(true);
        try {
            await cancelGitImport(jobId);
            clearActiveJob();
            setIsSubmitting(false);
            setProgress(null);
            setError("导入已取消");
        } catch (err) {
            setIsCancelling(false);
            setError((err as Error).message || "取消失败，请重试");
        }
    };

    const openWork = () => {
        if (!result) {
            return;
        }
        state.close();
        navigate({
            to: "/work/$id/edit",
            params: { id: result.workId },
        });
    };

    const showProgress = isSubmitting || progress !== null;

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[460px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading className="flex items-center gap-2">
                                <GitPullRequest className="size-4" />从 Git 导入
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            {result ? (
                                <ImportResult result={result} />
                            ) : showProgress ? (
                                <ImportProgress progress={progress} />
                            ) : (
                                <>
                                    <p className="text-sm text-foreground/60">
                                        导入公网 Git
                                        仓库的提交历史，每个提交会生成一个版本快照。
                                    </p>
                                    <TextField
                                        className="flex flex-col gap-1.5"
                                        value={repoUrl}
                                        onChange={setRepoUrl}
                                    >
                                        <Label className="text-xs text-foreground/60">
                                            仓库地址
                                            <span className="text-danger">
                                                {" "}
                                                *
                                            </span>
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <TextField
                                            className="flex flex-col gap-1.5"
                                            value={ref}
                                            onChange={setRef}
                                        >
                                            <Label className="text-xs text-foreground/60">
                                                分支 / 标签（可选）
                                            </Label>
                                            <Input placeholder="main" />
                                        </TextField>
                                        <TextField
                                            className="flex flex-col gap-1.5"
                                            value={depth}
                                            onChange={setDepth}
                                        >
                                            <Label className="text-xs text-foreground/60">
                                                提交深度（可选）
                                            </Label>
                                            <Input placeholder="最多 100" />
                                        </TextField>
                                    </div>
                                    <TextField
                                        className="flex flex-col gap-1.5"
                                        value={title}
                                        onChange={setTitle}
                                    >
                                        <Label className="text-xs text-foreground/60">
                                            作品标题（可选）
                                        </Label>
                                        <Input placeholder="缺省取仓库名" />
                                    </TextField>
                                </>
                            )}
                            {error && (
                                <p className="text-xs text-danger">{error}</p>
                            )}
                        </Modal.Body>
                        <Modal.Footer>
                            {result ? (
                                <>
                                    <Button slot="close" variant="tertiary">
                                        关闭
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onPress={openWork}
                                        className="gap-1.5"
                                    >
                                        <GitPullRequest className="size-3.5" />
                                        打开作品
                                    </Button>
                                </>
                            ) : showProgress ? (
                                <>
                                    <Button
                                        variant="danger"
                                        isDisabled={isCancelling}
                                        onPress={() => void cancelImport()}
                                    >
                                        {isCancelling ? "取消中…" : "取消导入"}
                                    </Button>
                                    <Button
                                        variant="primary"
                                        isDisabled
                                        className="gap-1.5"
                                    >
                                        <GitPullRequest className="size-3.5" />
                                        导入中…
                                    </Button>
                                </>
                            ) : (
                                <>
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
                                        className="gap-1.5"
                                    >
                                        <GitPullRequest className="size-3.5" />
                                        导入
                                    </Button>
                                </>
                            )}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

/**
 * 解析 SSE 事件负载；非 JSON 事件（如网络断开）返回 `null`。
 */
function parseEvent(event: Event): GitImportJobEvent | null {
    if (!(event instanceof MessageEvent)) {
        return null;
    }
    try {
        return JSON.parse(String(event.data)) as GitImportJobEvent;
    } catch {
        return null;
    }
}

/**
 * 导入进度面板：百分比进度条 + 阶段描述。
 */
function ImportProgress({
    progress,
}: {
    progress: { percent: number; message: string } | null;
}) {
    const percent = progress?.percent ?? 0;
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-foreground/60">
                <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    {progress?.message ?? "正在启动…"}
                </span>
                <span className="font-mono">{percent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-100">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
            </div>
        </div>
    );
}

/**
 * 导入结果面板：统计 + 被跳过文件及原因。
 */
function ImportResult({ result }: { result: GitImportResult }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="primary">
                    {result.commitCount} 个提交
                </Chip>
                <Chip size="sm" variant="soft">
                    {result.fileCount} 个文件
                </Chip>
                {result.skipped.length > 0 && (
                    <Chip size="sm" variant="soft" className="text-warning">
                        {result.skipped.length} 个文件被跳过
                    </Chip>
                )}
            </div>
            {result.skipped.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-foreground/60 flex items-center gap-1">
                        <AlertTriangle className="size-3.5 text-warning" />
                        以下文件未导入：
                    </p>
                    <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-lg border border-default-200 p-2">
                        {result.skipped.map((item) => (
                            <li
                                key={item.path}
                                className="flex items-center justify-between gap-2 text-xs"
                            >
                                <span className="truncate font-mono">
                                    {item.path}
                                </span>
                                <span className="shrink-0 text-foreground/50">
                                    {item.reason}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
