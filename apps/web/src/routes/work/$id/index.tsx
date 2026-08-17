import { Card, Chip } from "@heroui/react";
import {
    createFileRoute,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import { GitFork, Hash, Sparkles } from "lucide-react";
import { memo, useMemo } from "react";
import { useSWRConfig } from "swr";

import { RunPanel } from "~/components/editor/RunPanel";
import { AuthorCard } from "~/components/workDetail/AuthorCard";
import { CommentsSection } from "~/components/workDetail/CommentsSection";
import { CreationTree } from "~/components/workDetail/CreationTree";
import { SectionCard } from "~/components/workDetail/SectionCard";
import { VersionTimeline } from "~/components/workDetail/VersionTimeline";
import { WorkActions } from "~/components/workDetail/WorkActions";
import { WorkDetailHeader } from "~/components/workDetail/WorkDetailHeader";
import {
    WorkDetailSkeleton,
    WorkNotFound,
} from "~/components/workDetail/WorkDetailSkeleton";
import { useAuth } from "~/hooks/useAuth";
import { useComments } from "~/hooks/useComments";
import { useFocusedComment } from "~/hooks/useFocusedComment";
import { useFollowAuthor } from "~/hooks/useFollowAuthor";
import { useVersionHistory } from "~/hooks/useVersionHistory";
import { useWork } from "~/hooks/useWork";
import { useWorkDetailActions } from "~/hooks/useWorkDetailActions";
import { useWorkRemixes, useWorkSource } from "~/hooks/useWorkRemixes";
import { useWorkRunner } from "~/hooks/useWorkRunner";
import { useWorkSpark } from "~/hooks/useWorkSpark";
import { detectRuntime } from "~/lib/run";

export const Route = createFileRoute("/work/$id/")({
    validateSearch: (
        search: Record<string, unknown>,
    ): { comment?: string } => ({
        comment:
            typeof search.comment === "string" ? search.comment : undefined,
    }),
    component: WorkDetailRoute,
});

function WorkDetailRoute() {
    const { id: workId } = useParams({ from: "/work/$id/" });
    const { comment: focusCommentId } = Route.useSearch();
    const navigate = useNavigate();
    const { user, isLoggedIn } = useAuth();
    const { data: work, isLoading, error } = useWork(workId);
    const {
        data: comments,
        isLoading: commentsLoading,
        mutate: mutateComments,
    } = useComments(workId);
    const versions = useVersionHistory(workId).versions;
    const runtimeInfo = useMemo(
        () =>
            work ? detectRuntime(work.files.map((file) => file.name)) : null,
        [work],
    );
    const runner = useWorkRunner(workId, runtimeInfo);
    const spark = useWorkSpark(workId);
    const remixes = useWorkRemixes(workId);
    const source = useWorkSource(workId);
    const { mutate } = useSWRConfig();

    const commentsReady = !commentsLoading && !!comments;
    const { focusedCommentId } = useFocusedComment(
        focusCommentId,
        commentsReady,
    );
    const { handleSpark, handleRemix } = useWorkDetailActions({
        isLoggedIn,
        workId,
        user,
        spark,
        mutate,
        navigate,
    });
    const follow = useFollowAuthor(work);

    if (isLoading) {
        return <WorkDetailSkeleton />;
    }
    if (error || !work) {
        return <WorkNotFound />;
    }

    const isOwner = !!user && user.id === work.userId;
    const tags = work.tags ?? [];
    const commentCount = comments?.length ?? 0;

    return (
        <div className="w-full flex flex-col">
            <WorkDetailHeader
                title={work.title}
                workId={workId}
                canEdit={isOwner}
            />

            <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-20 flex flex-col gap-8">
                <div className="relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4">
                        <h1 className="flex-1 min-w-0 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.15] text-foreground text-balance">
                            {work.title}
                        </h1>
                    </div>
                </div>

                <WorkActions
                    workId={workId}
                    views={work.views}
                    sparks={work.sparks}
                    commentCount={commentCount}
                    runtime={runtimeInfo}
                    isOwner={isOwner}
                    isRunning={runner.running}
                    sparked={spark.sparked}
                    onRun={() => runner.runCurrent(work.files)}
                    onSpark={handleSpark}
                    onRemix={handleRemix}
                />

                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 -mt-3">
                        {tags.map((tag) => (
                            <Chip
                                key={tag}
                                size="sm"
                                variant="soft"
                                className="gap-1"
                            >
                                <Hash className="size-3 opacity-60" />
                                <Chip.Label>{tag}</Chip.Label>
                            </Chip>
                        ))}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                    <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
                        <div ref={runner.panelRef}>
                            <RunPanel
                                open={runner.isPanelOpen}
                                running={runner.running}
                                output={runner.output}
                                result={runner.result}
                                label={runner.label}
                                className="rounded-2xl border border-default-200/70 overflow-hidden"
                                awaitingInput={runner.awaitingInput}
                                onSubmitInput={runner.submitInput}
                                onCancelInput={runner.cancelInput}
                                onClose={runner.closePanel}
                                onClear={runner.clear}
                            />
                        </div>

                        <CommentsSection
                            workId={workId}
                            comments={comments}
                            isLoading={commentsLoading}
                            mutate={mutateComments}
                            focusCommentId={focusedCommentId}
                        />
                    </div>

                    <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-20 flex flex-col gap-6">
                        {work.description && (
                            <SectionCard title="作品简介" icon={Sparkles}>
                                <p className="text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                                    {work.description}
                                </p>
                            </SectionCard>
                        )}

                        <AuthorCard
                            author={work.author}
                            isSelf={follow.isSelf}
                            isPending={follow.pending}
                            onToggleFollow={follow.toggleFollow}
                        />

                        <SectionCard title="创作脉络" icon={GitFork}>
                            <CreationTree source={source} remixes={remixes} />
                        </SectionCard>

                        <SectionCard title="版本历史" icon={Hash}>
                            <VersionTimeline
                                versions={versions}
                                runningVersion={runner.activeVersion}
                                isRunning={runner.running}
                                onRun={(version) => runner.runVersion(version)}
                            />
                        </SectionCard>

                        <LikedCard />
                    </aside>
                </div>
            </main>
        </div>
    );
}

const LikedCard = memo(function LikedCard() {
    return (
        <Card className="w-full p-0 shadow-none rounded-2xl border border-default-200 bg-gradient-to-br from-primary/10 to-secondary/5">
            <Card.Content className="p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-foreground/80">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-sm font-semibold">
                        喜欢这个作品？
                    </span>
                </div>
                <p className="text-xs text-foreground/60 leading-relaxed">
                    送上一个火花支持作者，或点「二创」动手做一个同款吧 ~
                </p>
            </Card.Content>
        </Card>
    );
});
