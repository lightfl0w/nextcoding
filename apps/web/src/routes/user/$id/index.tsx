import { Avatar, Button, Skeleton, Tabs, toast } from "@heroui/react";
import {
    createFileRoute,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import {
    Activity,
    Award,
    Bookmark,
    FileText,
    MessageCircle,
    UserX,
} from "lucide-react";
import { useState } from "react";
import { AchievementGrid } from "~/components/achievements/AchievementGrid";
import { ActivityFeed } from "~/components/activities/ActivityFeed";
import { WorksGrid } from "~/components/WorksGrid";
import { useAuth } from "~/hooks/useAuth";
import { useFollowUser } from "~/hooks/useFollowUser";
import { useUser } from "~/hooks/useUser";
import { useUserAchievements } from "~/hooks/useUserAchievements";
import { useUserActivities } from "~/hooks/useUserActivities";
import { useUserWorks } from "~/hooks/useUserWorks";
import type { UserProfile } from "~/lib/api";
import { createConversation } from "~/lib/api/messages";
import { formatCount, formatDate } from "~/lib/format";

export const Route = createFileRoute("/user/$id/")({
    component: UserProfileRoute,
});

const PROFILE_SKELETON_KEYS = Array.from(
    { length: 6 },
    (_, index) => `profile-skeleton-${index + 1}`,
);

function UserProfileRoute() {
    const { id: userId } = useParams({ from: "/user/$id/" });
    const { user } = useAuth();
    const { data: profile, isLoading, error } = useUser(userId);
    const follow = useFollowUser(profile);
    const navigate = useNavigate();
    const [sendingMessage, setSendingMessage] = useState(false);

    const startChat = async () => {
        if (!profile) {
            return;
        }
        setSendingMessage(true);
        try {
            const conversation = await createConversation(profile.id);
            await navigate({
                to: "/chat/$id",
                params: { id: conversation.id },
            });
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setSendingMessage(false);
        }
    };

    if (isLoading) {
        return <ProfileSkeleton />;
    }
    if (error || !profile) {
        return <ProfileNotFound />;
    }

    const isMe = !!user && user.id === profile.id;

    return (
        <div className="w-full flex flex-col">
            <header className="w-full border-b border-default-200/70 bg-background">
                <div className="max-w-6xl mx-auto px-8 pt-10 pb-8 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <ProfileAvatar profile={profile} />

                        <div className="flex flex-col items-center md:items-start gap-1.5 flex-1 min-w-0">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                                {profile.name || "匿名用户"}
                            </h1>
                            <p className="text-xs text-foreground/50">
                                加入于 {formatDate(profile.createdAt)}
                            </p>
                            {!isMe && (
                                <div className="flex items-center gap-2 mt-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        isDisabled={sendingMessage}
                                        onPress={startChat}
                                    >
                                        <MessageCircle className="size-4" />
                                        发私信
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={
                                            profile.isFollowedByMe
                                                ? "secondary"
                                                : "primary"
                                        }
                                        isDisabled={follow.pending}
                                        onPress={follow.toggleFollow}
                                    >
                                        {profile.isFollowedByMe
                                            ? "已关注"
                                            : "关注"}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-10 shrink-0 justify-center md:justify-end md:pr-2">
                            <StatValue label="粉丝" value={profile.followers} />
                            <StatValue label="关注" value={profile.following} />
                        </div>
                    </div>

                    <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap text-center md:text-left">
                        {profile.bio || "TA 还没有填写简介"}
                    </p>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-8 py-8 w-full flex flex-col gap-4">
                <UserProfileTabs userId={userId} isMe={isMe} />
            </main>
        </div>
    );
}

function ProfileAvatar({ profile }: { profile: UserProfile }) {
    const name = profile.name || "匿名用户";
    return (
        <Avatar
            size="lg"
            className="size-20 md:size-24 shrink-0 mx-auto md:mx-0"
        >
            {profile.image ? (
                <Avatar.Image alt={name} src={profile.image} />
            ) : null}
            <Avatar.Fallback className="text-3xl md:text-4xl">
                {name.charAt(0).toUpperCase()}
            </Avatar.Fallback>
        </Avatar>
    );
}

function StatValue({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col items-center md:items-end gap-0.5">
            <span className="text-xl md:text-2xl font-bold tabular-nums leading-none">
                {formatCount(value)}
            </span>
            <span className="text-xs text-foreground/50">{label}</span>
        </div>
    );
}

function UserProfileTabs({ userId, isMe }: { userId: string; isMe: boolean }) {
    const [tab, setTab] = useState("works");

    return (
        <div className="flex flex-col gap-4">
            <Tabs
                selectedKey={tab}
                onSelectionChange={(key) => setTab(key as string)}
                className="w-full"
            >
                <Tabs.ListContainer>
                    <Tabs.List aria-label="用户资料标签">
                        <Tabs.Tab
                            id="works"
                            className="flex items-center gap-1.5"
                        >
                            <FileText className="size-4" />
                            作品
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab
                            id="activities"
                            className="flex items-center gap-1.5"
                        >
                            <Activity className="size-4" />
                            动态
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        {isMe && (
                            <Tabs.Tab
                                id="bookmarks"
                                className="flex items-center gap-1.5"
                            >
                                <Bookmark className="size-4" />
                                收藏
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        )}
                        <Tabs.Tab
                            id="achievements"
                            className="flex items-center gap-1.5"
                        >
                            <Award className="size-4" />
                            成就
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>

            {tab === "works" && <UserWorks userId={userId} />}
            {tab === "activities" && <UserActivities userId={userId} />}
            {tab === "bookmarks" && isMe && <UserBookmarks userId={userId} />}
            {tab === "achievements" && <UserAchievements userId={userId} />}
        </div>
    );
}

function UserWorks({ userId }: { userId: string }) {
    const { data: works, isLoading, error } = useUserWorks(userId);
    return (
        <WorksGrid
            works={works}
            isLoading={isLoading}
            error={error}
            placeholderCount={6}
            emptyText="TA 还没有发布作品"
        />
    );
}

function UserActivities({ userId }: { userId: string }) {
    const { activities, isLoading } = useUserActivities(userId, 50);
    return (
        <ActivityFeed
            activities={activities}
            isLoading={isLoading}
            emptyText="暂无动态"
        />
    );
}

function UserBookmarks({ userId }: { userId: string }) {
    const { data: works, isLoading, error } = useUserWorks(userId);
    return (
        <WorksGrid
            works={works}
            isLoading={isLoading}
            error={error}
            placeholderCount={6}
            emptyText="暂无收藏"
        />
    );
}

function UserAchievements({ userId }: { userId: string }) {
    const { achievements, isLoading } = useUserAchievements(userId);
    return (
        <AchievementGrid achievements={achievements} isLoading={isLoading} />
    );
}

function ProfileNotFound() {
    return (
        <div className="p-8 w-full flex flex-col items-center justify-center gap-2 text-foreground/60 min-h-[40vh]">
            <UserX className="size-8" />
            <p className="text-sm">用户不存在或已注销</p>
        </div>
    );
}

function ProfileSkeleton() {
    return (
        <div className="w-full flex flex-col">
            <div className="w-full border-b border-default-200/70 bg-background">
                <div className="max-w-6xl mx-auto px-8 pt-10 pb-8 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <Skeleton className="size-20 md:size-24 rounded-full shrink-0 mx-auto md:mx-0" />
                        <div className="flex flex-col items-center md:items-start gap-2 flex-1 min-w-0">
                            <Skeleton className="h-7 w-40 rounded-md" />
                            <Skeleton className="h-4 w-24 rounded-md" />
                            <Skeleton className="h-8 w-16 rounded-full mt-1" />
                        </div>
                        <div className="flex items-center gap-10 shrink-0 justify-center md:justify-end md:pr-2">
                            <Skeleton className="h-9 w-12 rounded-md" />
                            <Skeleton className="h-9 w-12 rounded-md" />
                        </div>
                    </div>
                    <Skeleton className="h-4 w-full rounded-md" />
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 py-8 w-full flex flex-col gap-4">
                <Skeleton className="h-6 w-20 rounded-md" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {PROFILE_SKELETON_KEYS.map((key) => (
                        <div key={key} className="flex flex-col gap-2">
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-4 w-2/3 rounded-md" />
                            <Skeleton className="h-3 w-full rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
