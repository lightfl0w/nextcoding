import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import type { OwnedWork } from "~/lib/api";
import { fetchMyWorks, myWorksKey } from "~/lib/api";

const NO_WORKS: OwnedWork[] = [];

export function useMyWorks() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data, mutate } = useSWR<OwnedWork[]>(
        userId ? myWorksKey(userId) : null,
        fetchMyWorks,
    );

    return { works: data ?? NO_WORKS, mutate };
}
