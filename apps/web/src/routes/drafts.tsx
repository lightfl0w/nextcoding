import {
    AlertDialog,
    Button,
    Chip,
    Spinner,
    toast,
    useOverlayState,
} from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FilePenLine, LogIn, Pencil, Rocket } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAuth } from "~/hooks/useAuth";
import { useMyWorks } from "~/hooks/useMyWorks";
import { publishWork } from "~/lib/api";
import { formatDate } from "~/lib/format";

export const Route = createFileRoute("/drafts")({
    component: DraftsPage,
});

function DraftsPage() {
    const { user, isPending } = useAuth();

    if (isPending) {
        return (
            <div className="p-8 w-full flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!user) {
        return <SignInPrompt />;
    }

    return <DraftsList />;
}

interface PublishedWork {
    id: string;
    title: string;
}

function DraftsList() {
    const { works, mutate } = useMyWorks();
    const navigate = useNavigate();
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [publishedWork, setPublishedWork] = useState<PublishedWork | null>(
        null,
    );
    const dialogState = useOverlayState();

    const drafts = works.filter((work) => work.status === "draft");

    const handlePublish = useCallback(
        async (workId: string, title: string) => {
            if (publishingId) {
                return;
            }
            setPublishingId(workId);
            try {
                await publishWork(workId);
                await mutate();
                setPublishedWork({ id: workId, title });
                dialogState.open();
            } catch (error) {
                toast.danger((error as Error).message);
            } finally {
                setPublishingId(null);
            }
        },
        [mutate, publishingId, dialogState],
    );

    const goToWork = useCallback(() => {
        if (publishedWork) {
            navigate({ to: "/work/$id", params: { id: publishedWork.id } });
        }
        dialogState.close();
    }, [publishedWork, navigate, dialogState]);

    const stayHere = useCallback(() => {
        setPublishedWork(null);
        dialogState.close();
    }, [dialogState]);

    return (
        <div className="mx-auto w-full max-w-6xl p-8 flex flex-col gap-6">
            <PageHeader
                title="草稿管理"
                description="管理你的未发布作品，随时继续编辑或发布"
            />

            <AlertDialog.Backdrop
                isOpen={dialogState.isOpen}
                onOpenChange={dialogState.setOpen}
            >
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-100">
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="success" />
                            <AlertDialog.Heading>
                                「{publishedWork?.title}」发布成功
                            </AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>
                                你的作品已公开，其他用户现在可以浏览和互动了。
                            </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button
                                slot="close"
                                variant="tertiary"
                                onPress={stayHere}
                            >
                                留在草稿页
                            </Button>
                            <Button
                                slot="close"
                                variant="primary"
                                onPress={goToWork}
                            >
                                查看作品
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>

            {drafts.length === 0 ? (
                <EmptyState
                    icon={FilePenLine}
                    title="暂无草稿"
                    hint="创建的作品会自动保存为草稿"
                />
            ) : (
                <div className="flex flex-col gap-2">
                    {drafts.map((work) => (
                        <DraftRow
                            key={work.id}
                            work={work}
                            publishingId={publishingId}
                            onPublish={handlePublish}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function DraftRow({
    work,
    publishingId,
    onPublish,
}: {
    work: { id: string; title: string; updatedAt: string };
    publishingId: string | null;
    onPublish: (workId: string, title: string) => void;
}) {
    const navigate = useNavigate();

    return (
        <div className="group flex items-center gap-3 rounded-xl border border-default-200/70 bg-background px-4 py-3 transition-colors hover:border-default-300 min-w-0">
            <Chip size="sm" variant="soft">
                草稿
            </Chip>
            <Link
                to="/work/$id/edit"
                params={{ id: work.id }}
                className="flex-1 min-w-0 flex items-center gap-2"
            >
                <span className="truncate text-sm font-medium">
                    {work.title}
                </span>
            </Link>
            <span className="text-xs text-foreground/40 shrink-0 hidden sm:inline">
                更新于 {formatDate(work.updatedAt)}
            </span>
            <div className="flex items-center gap-2 shrink-0">
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onPress={() =>
                        navigate({
                            to: "/work/$id/edit",
                            params: { id: work.id },
                        })
                    }
                >
                    <Pencil className="size-3.5" />
                    编辑
                </Button>
                <Button
                    size="sm"
                    variant="primary"
                    className="gap-1.5"
                    isDisabled={publishingId === work.id}
                    onPress={() => onPublish(work.id, work.title)}
                >
                    <Rocket className="size-3.5" />
                    {publishingId === work.id ? "发布中…" : "发布"}
                </Button>
            </div>
        </div>
    );
}

function SignInPrompt() {
    return (
        <div className="p-8 w-full flex flex-col items-center gap-4 py-24">
            <div className="size-12 rounded-full bg-default-100/70 flex items-center justify-center text-foreground/45">
                <LogIn className="size-6" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center gap-1">
                <p className="text-base font-medium">登录后查看你的草稿</p>
                <p className="text-xs text-foreground/45">管理未发布的作品</p>
            </div>
            <Link to="/auth" search={{ mode: "login", redirect: "/drafts" }}>
                <Button variant="primary">去登录</Button>
            </Link>
        </div>
    );
}
