import { parseTags } from "./tags.js";

interface AuthoredRow {
    authorId: string | null;
    authorName: string | null;
    authorImage: string | null;
    authorBio: string | null;
}

interface WorkSummaryRow extends AuthoredRow {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    tags: string | null;
    views: number;
    likes: number;
    sparks: number;
    createdAt: Date;
}

interface WorkDetailRow extends WorkSummaryRow {
    userId: string;
    status: "draft" | "published";
    updatedAt: Date;
    followerCount: number | null;
    isFollowing: number | null;
}

interface CommentRow extends AuthoredRow {
    id: string;
    content: string;
    parentId: string | null;
    createdAt: Date;
}

interface NotificationRow {
    id: string;
    type: "spark" | "remix" | "comment";
    read: boolean;
    createdAt: Date;
    actorId: string | null;
    actorName: string | null;
    workId: string | null;
    workTitle: string | null;
    commentId: string | null;
    commentContent: string | null;
}

interface OwnedWorkRow {
    id: string;
    title: string;
    status: "draft" | "published";
    sparks: number;
    views: number;
    createdAt: Date;
    updatedAt: Date;
}

export function toWorkSummary(row: WorkSummaryRow) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        coverUrl: row.coverUrl,
        tags: parseTags(row.tags),
        views: row.views,
        likes: row.likes,
        sparks: row.sparks,
        createdAt: row.createdAt,
        author: toAuthor(row),
    };
}

export function toWorkDetail<TFile>(row: WorkDetailRow, files: TFile[]) {
    const summary = toWorkSummary(row);
    return {
        ...summary,
        userId: row.userId,
        status: row.status,
        updatedAt: row.updatedAt,
        files,
        author: {
            ...summary.author,
            followers: row.followerCount ?? 0,
            followedByMe: Boolean(row.isFollowing),
        },
    };
}

export function toComment(row: CommentRow) {
    return {
        id: row.id,
        content: row.content,
        parentId: row.parentId,
        createdAt: row.createdAt,
        author: toAuthor(row),
    };
}

export function toNotification(row: NotificationRow) {
    return {
        id: row.id,
        type: row.type,
        read: row.read,
        createdAt: row.createdAt,
        actor: row.actorId ? { id: row.actorId, name: row.actorName } : null,
        work: row.workId ? { id: row.workId, title: row.workTitle } : null,
        comment: row.commentId
            ? { id: row.commentId, content: row.commentContent }
            : null,
    };
}

export function toOwnedWork(row: OwnedWorkRow) {
    return {
        id: row.id,
        title: row.title,
        status: row.status,
        sparks: row.sparks,
        views: row.views,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toAuthor(row: AuthoredRow) {
    return {
        id: row.authorId,
        name: row.authorName,
        image: row.authorImage,
        bio: row.authorBio,
    };
}
