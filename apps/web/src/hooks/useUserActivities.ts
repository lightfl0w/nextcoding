import useSWR from "swr";
import {
    type Activity,
    fetchUserActivities,
    userActivitiesPath,
} from "~/lib/api/activities";

const EMPTY_ACTIVITIES: Activity[] = [];

export function useUserActivities(userId: string, limit?: number) {
    const { data, isLoading, error } = useSWR<Activity[]>(
        userActivitiesPath(userId, limit),
        fetchUserActivities,
    );
    return { activities: data ?? EMPTY_ACTIVITIES, isLoading, error };
}
