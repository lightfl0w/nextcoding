import {
    Avatar,
    Button,
    Card,
    Chip,
    Input,
    Label,
    Modal,
    Spinner,
    TextArea,
    toast,
    useOverlayState,
} from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
    Camera,
    FileText,
    LogIn,
    LogOut,
    Pencil,
    Plus,
    Sparkles,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { AvatarCropModal } from "~/components/AvatarCropModal";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { SectionHeading } from "~/components/ui/SectionHeading";
import { useAuth } from "~/hooks/useAuth";
import { useMyStats } from "~/hooks/useMyStats";
import { useMyWorks } from "~/hooks/useMyWorks";
import { createWork, type OwnedWork, uploadAvatar } from "~/lib/api";
import { formatDate } from "~/lib/format";

export const Route = createFileRoute("/account")({
    component: AccountRoute,
});

function AccountRoute() {
    const { user, isPending } = useAuth();
    const { givenSparks } = useMyStats();

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

    return (
        <div className="mx-auto w-full max-w-6xl p-8 flex flex-col gap-6">
            <PageHeader
                title="我的账号"
                description="管理你的资料、火花与作品"
            />

            <ProfileCard givenSparks={givenSparks} />

            <MyWorksSection />
        </div>
    );
}

function ProfileCard({ givenSparks }: { givenSparks: number }) {
    const { user, refetch } = useAuth();
    const navigate = useNavigate();
    const editDialogState = useOverlayState();
    const [name, setName] = useState(user?.name ?? "");
    const [image, setImage] = useState(user?.image ?? "");
    const [bio, setBio] = useState(user?.bio ?? "");

    const openEdit = () => {
        setName(user?.name ?? "");
        setImage(user?.image ?? "");
        setBio(user?.bio ?? "");
        editDialogState.open();
    };

    const saveProfile = async (nextImage?: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return;
        }
        try {
            const { error } = await authClient.updateUser({
                name: trimmedName,
                image: (nextImage ?? image).trim(),
                bio: bio.trim(),
            });
            if (error) {
                throw new Error(error.message ?? "更新失败");
            }
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
                    <ProfileIdentity user={user} onEdit={openEdit} />

                    <div className="flex items-center gap-1.5 text-sm text-foreground/80">
                        <Sparkles className="size-4 text-warning" />
                        <span className="font-medium tabular-nums">
                            {givenSparks}
                        </span>
                        <span className="text-foreground/50">个火花</span>
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
                bio={bio}
                onNameChange={setName}
                onBioChange={setBio}
                onSave={saveProfile}
            />
        </>
    );
}

const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

function ProfileEditModal({
    state,
    name,
    image,
    bio,
    onNameChange,
    onBioChange,
    onSave,
}: {
    state: ReturnType<typeof useOverlayState>;
    name: string;
    image: string;
    bio: string;
    onNameChange: (value: string) => void;
    onBioChange: (value: string) => void;
    onSave: (nextImage?: string) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

    const effectiveAvatarSrc = localPreview ?? image;

    const handlePickFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.danger("请选择图片文件");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.danger("图片不能超过 5 MB");
            return;
        }
        setPendingCropFile(file);
    };

    const handleCropped = async (croppedFile: File) => {
        if (localPreview) {
            URL.revokeObjectURL(localPreview);
        }
        const preview = URL.createObjectURL(croppedFile);
        setLocalPreview(preview);
        setPendingCropFile(null);
        setIsUploading(true);
        try {
            const result = await uploadAvatar(croppedFile);
            await onSave(result.url);
        } catch (err) {
            toast.danger((err as Error).message);
        } finally {
            URL.revokeObjectURL(preview);
            setLocalPreview(null);
            setIsUploading(false);
        }
    };

    const handleCropCancel = () => {
        setPendingCropFile(null);
    };

    return (
        <>
            <Modal state={state}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[440px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>修改资料</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2 items-center">
                                    <Label>头像</Label>
                                    <div className="relative">
                                        <Avatar
                                            size="lg"
                                            className="size-24 ring-2 ring-default-200"
                                        >
                                            {effectiveAvatarSrc ? (
                                                <Avatar.Image
                                                    alt="头像预览"
                                                    src={effectiveAvatarSrc}
                                                />
                                            ) : null}
                                            <Avatar.Fallback className="text-2xl">
                                                {name
                                                    ? name
                                                          .trim()
                                                          .charAt(0)
                                                          .toUpperCase()
                                                    : "?"}
                                            </Avatar.Fallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept={AVATAR_ACCEPT}
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="gap-1.5"
                                            onPress={handlePickFile}
                                            isDisabled={isUploading}
                                        >
                                            {isUploading ? (
                                                <Spinner
                                                    size="sm"
                                                    className="!size-3.5"
                                                />
                                            ) : (
                                                <Camera className="size-3.5" />
                                            )}
                                            {isUploading
                                                ? "应用中"
                                                : "选择图片"}
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-foreground/40">
                                        支持 JPG、PNG、WebP、GIF，最大 5 MB
                                    </p>
                                </div>

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
                                    <Label>简介</Label>
                                    <TextArea
                                        placeholder="介绍一下自己（可选）"
                                        value={bio}
                                        onChange={(event) =>
                                            onBioChange(event.target.value)
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
                                    onPress={() => onSave()}
                                >
                                    保存
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            <AvatarCropModal
                file={pendingCropFile}
                onCrop={handleCropped}
                onCancel={handleCropCancel}
            />
        </>
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
            <SectionHeading
                title="我的作品"
                action={
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
                }
            />

            {works.length === 0 ? (
                <EmptyState icon={FileText} title="还没有作品，发布第一个吧" />
            ) : (
                <div className="flex flex-col gap-2">
                    {works.map((work) => (
                        <WorkRowLink key={work.id} work={work} />
                    ))}
                </div>
            )}
        </section>
    );
}

interface ProfileIdentityUser {
    name: string;
    image?: string | null;
    email?: string | null;
}

/**
 * 头像与昵称信息行。
 * @param props.user - 当前用户。
 * @param props.onEdit - 打开修改资料弹窗。
 */
function ProfileIdentity({
    user,
    onEdit,
}: {
    user: ProfileIdentityUser | null;
    onEdit: () => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <Avatar size="lg">
                {user?.image ? (
                    <Avatar.Image alt={user.name} src={user.image} />
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
                        onPress={onEdit}
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
    );
}

/**
 * 作品列表行。
 * @param props.work - 作品数据。
 */
function WorkRowLink({ work }: { work: OwnedWork }) {
    return (
        <Link
            to={work.status === "draft" ? "/work/$id/edit" : "/work/$id"}
            params={{ id: work.id }}
            className="group flex items-center gap-3 rounded-xl border border-default-200/70 bg-background px-4 py-3 transition-colors hover:border-default-300 min-w-0"
        >
            <Chip
                size="sm"
                variant={work.status === "published" ? "primary" : "soft"}
            >
                {work.status === "published" ? "已发布" : "草稿"}
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
    );
}

function SignInPrompt() {
    return (
        <div className="p-8 w-full flex flex-col items-center gap-4 py-24">
            <div className="size-12 rounded-full bg-default-100/70 flex items-center justify-center text-foreground/45">
                <LogIn className="size-6" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center gap-1">
                <p className="text-base font-medium">登录后查看你的账号</p>
                <p className="text-xs text-foreground/45">
                    管理资料、火花与你的作品
                </p>
            </div>
            <Link to="/auth" search={{ mode: "login", redirect: "/account" }}>
                <Button variant="primary">去登录</Button>
            </Link>
        </div>
    );
}
