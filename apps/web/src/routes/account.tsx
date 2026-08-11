import {
    Avatar,
    Button,
    Card,
    Chip,
    Input,
    Label,
    Modal,
    Spinner,
    toast,
    useOverlayState,
} from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, LogOut, Pencil, Plus, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useMyWorks } from "~/hooks/useMyWorks";
import { createWork } from "~/lib/api";
import { formatDate } from "~/lib/format";

export const Route = createFileRoute("/account")({
    component: AccountRoute,
});

function AccountRoute() {
    const { user, isPending } = useAuth();

    if (isPending) {
        return (
            <div className="p-8 w-full flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!user) return <SignInPrompt />;

    return (
        <div className="p-8 w-full flex flex-col gap-6 max-w-3xl mx-auto">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-balance">
                    我的账号
                </h1>
                <p className="text-sm text-foreground/60">
                    管理你的资料、火花与作品
                </p>
            </header>

            <ProfileCard />

            <MyWorksSection />
        </div>
    );
}

function ProfileCard() {
    const { user, refetch } = useAuth();
    const navigate = useNavigate();
    const editDialogState = useOverlayState();
    const [name, setName] = useState(user?.name ?? "");
    const [image, setImage] = useState(user?.image ?? "");

    const openEdit = () => {
        setName(user?.name ?? "");
        setImage(user?.image ?? "");
        editDialogState.open();
    };

    const saveProfile = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        try {
            const { error } = await authClient.updateUser({
                name: trimmedName,
                image: image.trim(),
            });
            if (error) throw new Error(error.message ?? "更新失败");
            editDialogState.close();
            toast.success("资料已更新");
            refetch();
        } catch (err) {
            toast.danger((err as Error).message);
        }
    };

    const signOut = async () => {
        await authClient.signOut();
        navigate({ to: "/" });
    };

    return (
        <>
            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Avatar size="lg">
                            {user?.image ? (
                                <Avatar.Image
                                    alt={user.name}
                                    src={user.image}
                                />
                            ) : null}
                            <Avatar.Fallback>
                                {(user?.name ?? "?").charAt(0).toUpperCase()}
                            </Avatar.Fallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-base font-semibold truncate">
                                    {user?.name ?? "未命名"}
                                </span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    className="size-6 min-w-0"
                                    onPress={openEdit}
                                    aria-label="修改资料"
                                >
                                    <Pencil className="size-3.5" />
                                </Button>
                            </div>
                            <span className="text-xs text-foreground/50 truncate">
                                {user?.email}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-foreground/50">
                        <span>
                            注册于 {user ? formatDate(user.createdAt) : "—"}
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-danger"
                            onPress={signOut}
                        >
                            <LogOut className="size-3.5" />
                            退出登录
                        </Button>
                    </div>
                </Card.Content>
            </Card>

            <ProfileEditModal
                state={editDialogState}
                name={name}
                image={image}
                onNameChange={setName}
                onImageChange={setImage}
                onSave={saveProfile}
            />
        </>
    );
}

function ProfileEditModal({
    state,
    name,
    image,
    onNameChange,
    onImageChange,
    onSave,
}: {
    state: ReturnType<typeof useOverlayState>;
    name: string;
    image: string;
    onNameChange: (value: string) => void;
    onImageChange: (value: string) => void;
    onSave: () => void;
}) {
    return (
        <Modal state={state}>
            <Modal.Backdrop />
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-[400px]">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>修改资料</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>昵称</Label>
                            <Input
                                autoFocus
                                placeholder="你的昵称"
                                value={name}
                                onChange={(event) =>
                                    onNameChange(event.target.value)
                                }
                                onKeyDown={(event) =>
                                    event.key === "Enter" && onSave()
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>头像地址</Label>
                            <Input
                                placeholder="图片链接（可选）"
                                value={image}
                                onChange={(event) =>
                                    onImageChange(event.target.value)
                                }
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button slot="close" variant="tertiary">
                            取消
                        </Button>
                        <Button
                            variant="primary"
                            isDisabled={!name.trim()}
                            onPress={onSave}
                        >
                            保存
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal>
    );
}

function MyWorksSection() {
    const { works, mutate: mutateMyWorks } = useMyWorks();
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = useState(false);

    const createNew = useCallback(async () => {
        setIsCreating(true);
        try {
            const { id } = await createWork("未命名作品");
            await mutateMyWorks();
            navigate({ to: "/work/$id/edit", params: { id } });
        } catch (err) {
            toast.danger((err as Error).message);
        } finally {
            setIsCreating(false);
        }
    }, [navigate, mutateMyWorks]);

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="size-4 text-foreground/50" />
                    <Label className="text-base">我的作品</Label>
                </div>
                <Button
                    size="sm"
                    variant="primary"
                    className="gap-1.5"
                    isDisabled={isCreating}
                    onPress={createNew}
                >
                    <Plus className="size-3.5" />
                    新建作品
                </Button>
            </div>

            {works.length === 0 ? (
                <Card className="p-0 shadow-none rounded-2xl border border-dashed border-default-300 bg-background">
                    <Card.Content className="py-10 flex flex-col items-center gap-2 text-foreground/45">
                        <FileText className="size-6" strokeWidth={1.5} />
                        <p className="text-sm">还没有作品，发布第一个吧</p>
                    </Card.Content>
                </Card>
            ) : (
                <div className="flex flex-col gap-2">
                    {works.map((work) => (
                        <Link
                            key={work.id}
                            to={
                                work.status === "draft"
                                    ? "/work/$id/edit"
                                    : "/work/$id"
                            }
                            params={{ id: work.id }}
                            className="group flex items-center gap-3 rounded-xl border border-default-200/70 bg-background px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-default-300 hover:shadow-md min-w-0"
                        >
                            <Chip
                                size="sm"
                                variant={
                                    work.status === "published"
                                        ? "primary"
                                        : "soft"
                                }
                            >
                                {work.status === "published"
                                    ? "已发布"
                                    : "草稿"}
                            </Chip>
                            <span className="flex-1 truncate text-sm font-medium">
                                {work.title}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-foreground/55 tabular-nums">
                                <Sparkles className="size-3 text-warning" />
                                {work.sparks}
                            </span>
                            <span className="text-xs text-foreground/40 shrink-0">
                                {formatDate(work.updatedAt)}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}

function SignInPrompt() {
    return (
        <div className="p-8 w-full flex flex-col items-center gap-3 py-24">
            <p className="text-base font-medium">登录后查看你的账号</p>
            <Link to="/auth" search={{ mode: "login", redirect: "/account" }}>
                <Button variant="primary">去登录</Button>
            </Link>
        </div>
    );
}
