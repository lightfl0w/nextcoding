import {
    Avatar,
    Button,
    Card,
    Chip,
    Spinner,
    Tabs,
    toast,
    useOverlayState,
} from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
    FileText,
    LogIn,
    LogOut,
    Pencil,
    Plus,
    Settings,
    Sparkles,
} from "lucide-react";
import { useCallback, useState } from "react";
import { ProfileEditModal } from "~/components/account/ProfileEditModal";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { SectionHeading } from "~/components/ui/SectionHeading";
import { useAuth } from "~/hooks/useAuth";
import { useMyStats } from "~/hooks/useMyStats";
import { useMyWorks } from "~/hooks/useMyWorks";
import type { OwnedWork } from "~/lib/api";
import { formatDate } from "~/lib/format";

export const Route = createFileRoute("/account")({
    component: AccountRoute,
});

function AccountRoute() {
    const { user, isPending } = useAuth();
    const [tab, setTab] = useState("profile");

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
                description="管理你的资料、火花、作品与设置"
            />

            <Tabs
                selectedKey={tab}
                onSelectionChange={(key) => setTab(key as string)}
                className="w-full"
            >
                <Tabs.ListContainer>
                    <Tabs.List aria-label="账号设置">
                        <Tabs.Tab
                            id="profile"
                            className="flex items-center gap-1.5"
                        >
                            <Sparkles className="size-4" />
                            账号
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab
                            id="settings"
                            className="flex items-center gap-1.5"
                        >
                            <Settings className="size-4" />
                            设置
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>

            {tab === "profile" && <ProfileTab />}
            {tab === "settings" && <SettingsPanel />}
        </div>
    );
}

function ProfileTab() {
    const { givenSparks } = useMyStats();
    return (
        <div className="flex flex-col gap-6">
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

function MyWorksSection() {
    const { works } = useMyWorks();
    const navigate = useNavigate();

    const publishedWorks = works.filter((work) => work.status === "published");
    const draftCount = works.length - publishedWorks.length;

    const createNew = useCallback(() => {
        navigate({ to: "/work/new/edit" });
    }, [navigate]);

    const goToDrafts = useCallback(() => {
        navigate({ to: "/drafts" });
    }, [navigate]);

    return (
        <section className="flex flex-col gap-4">
            <SectionHeading
                title="我的作品"
                action={
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            onPress={goToDrafts}
                        >
                            <FileText className="size-3.5" />
                            草稿
                            {draftCount > 0 && (
                                <span className="tabular-nums">
                                    {draftCount}
                                </span>
                            )}
                        </Button>
                        <Button
                            size="sm"
                            variant="primary"
                            className="gap-1.5"
                            onPress={createNew}
                        >
                            <Plus className="size-3.5" />
                            新建作品
                        </Button>
                    </div>
                }
            />

            {publishedWorks.length === 0 ? (
                <EmptyState icon={FileText} title="还没有已发布的作品" />
            ) : (
                <div className="flex flex-col gap-2">
                    {publishedWorks.map((work) => (
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
