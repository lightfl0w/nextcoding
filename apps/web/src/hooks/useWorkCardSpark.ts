import { toast } from "@heroui/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, useCallback, useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import {
    SPARK_ALREADY_SENT,
    SPARK_SELF_MESSAGE,
    useGiveSpark,
} from "~/hooks/useGiveSpark";
import type { Work } from "~/lib/api";

export function useWorkCardSpark(work: Work) {
    const { user, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const giveSpark = useGiveSpark();
    const [sparked, setSparkled] = useState(work.sparked ?? false);
    const [count, setCount] = useState(work.sparks);

    const handleSparkClick = useCallback(
        async (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isLoggedIn) {
                navigate({
                    to: "/auth",
                    search: { mode: "login", redirect: location.pathname },
                });
                return;
            }
            if (sparked) {
                toast.warning(SPARK_ALREADY_SENT);
                return;
            }
            if (user?.id === work.author.id) {
                toast.warning(SPARK_SELF_MESSAGE);
                return;
            }
            const ok = await giveSpark(work.id);
            if (ok) {
                setSparkled(true);
                setCount((current) => current + 1);
            }
        },
        [
            isLoggedIn,
            navigate,
            location.pathname,
            sparked,
            user?.id,
            work.id,
            work.author.id,
            giveSpark,
        ],
    );

    return { sparked, count, handleSparkClick };
}
