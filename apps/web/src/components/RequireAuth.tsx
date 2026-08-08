import { Button } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "~/hooks/useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, isPending } = useAuth();
    const navigate = useNavigate();

    if (isPending) {
        return <div className="h-10" aria-hidden />;
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-foreground/60">请先登录后再操作</p>
                <Button
                    variant="secondary"
                    fullWidth
                    onPress={() =>
                        navigate({
                            to: "/auth",
                            search: { mode: "login", redirect: "/" },
                        })
                    }
                >
                    登录
                </Button>
            </div>
        );
    }

    return <>{children}</>;
}
