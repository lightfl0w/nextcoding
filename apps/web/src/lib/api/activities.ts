import { getJson } from "./http";

export interface ActivityUser {
    id: string;
    name: string | null;
    image: string | null;
}

export interface ActivityWork {
    id: string;
    title: string;
}

export interface Activity {
    id: string;
    type: "spark" | "remix" | "comment" | "publish" | "follow" | "template";
    actor: ActivityUser | null;
    work: ActivityWork | null;
    targetUser: ActivityUser | null;
    comment: { id: string; content: string } | null;
    createdAt: string;
}

export function userActivitiesPath(
    userId: string,
    limit?: number,
    offset?: number,
) {
    const params = new URLSearchParams();
    if (limit) {
        params.set("limit", String(limit));
    }
    if (offset) {
        params.set("offset", String(offset));
    }
    const qs = params.toString();
    return `/api/users/${userId}/activities${qs ? `?${qs}` : ""}`;
}

export function feedPath(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) {
        params.set("limit", String(limit));
    }
    if (offset) {
        params.set("offset", String(offset));
    }
    const qs = params.toString();
    return `/api/feed${qs ? `?${qs}` : ""}`;
}

export async function fetchUserActivities(path: string): Promise<Activity[]> {
    return getJson<Activity[]>(path);
}

export async function fetchFeed(path: string): Promise<Activity[]> {
    return getJson<Activity[]>(path);
}
