export interface Author {
    id: string | null;
    name: string | null;
    image: string | null;
    bio: string | null;
    followers?: number;
    followedByMe?: boolean;
}

export interface UserProfile {
    id: string;
    name: string;
    image: string | null;
    bio: string | null;
    createdAt: string;
    followers: number;
    following: number;
    isFollowedByMe: boolean;
}

export interface Work {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    tags: string[];
    views: number;
    likes: number;
    sparks: number;

    sparked?: boolean;
    createdAt: string;
    author: Author;
}

export type WorkSort = "latest" | "popular" | "weekly";

export interface WorkFile {
    id: string;
    key: string;
    name: string;
    size: number;
    contentType: string | null;
    version: number;
    createdAt: string;
}

export type WorkDetail = Work & {
    userId: string;
    status: "draft" | "published";
    templateId: string | null;
    files: WorkFile[];
};

export interface WorkVersion {
    version: number;
    message: string | null;
    createdAt: string;
    author: { id: string; name: string | null } | null;
}

export interface SnapshotFile {
    key: string;
    name: string;
    contentType: string | null;
    content: string;
    encoding?: "base64";
    hash?: string;
}

export interface Snapshot {
    version: number;
    message: string | null;
    createdAt: number;
    files: SnapshotFile[];
}

export interface Comment {
    id: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    author: Author;
}

export interface WorkSource {
    id: string;
    title: string;
}

export interface AppNotification {
    id: string;
    type: "spark" | "remix" | "comment" | "template";
    read: boolean;
    createdAt: string;
    actor: { id: string; name: string | null } | null;
    work: WorkSource | null;
    comment: { id: string; content: string } | null;
}

export interface RemixResult {
    id: string;
    title: string;
}

export interface OwnedWork {
    id: string;
    title: string;
    status: "draft" | "published";
    sparks: number;
    views: number;
    createdAt: string;
    updatedAt: string;
}
