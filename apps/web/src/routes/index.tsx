import { Button, toast } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useSWRConfig } from "swr";
import { FeaturedWorks } from "~/components/FeaturedWorks";
import { SectionHeading } from "~/components/ui/SectionHeading";
import { useAuth } from "~/hooks/useAuth";
import { createWork, myWorksKey } from "~/lib/api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth();
    const { mutate } = useSWRConfig();

    const submitCreate = async () => {
        if (!isLoggedIn) {
            navigate({
                to: "/auth",
                search: { mode: "login", redirect: "/" },
            });
            return;
        }

        try {
            const { id } = await createWork(`${user?.name} 的作品`);
            if (user) {
                await mutate(myWorksKey(user.id));
            }
            navigate({ to: "/work/$id/edit", params: { id } });
        } catch (err) {
            toast.danger((err as Error).message);
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-8">
            <section className="relative overflow-hidden rounded-3xl border border-default-200/70 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
                <div className="relative z-10 px-8 py-12 flex flex-col items-start gap-6">
                    <div className="flex items-center gap-4">
                        <img
                            src="/logo.png"
                            alt="NextCoding 吉祥物"
                            className="w-16 h-16 rounded-2xl shadow-sm"
                        />
                        <div className="flex flex-col gap-1">
                            <h1 className="text-3xl font-bold tracking-tight text-balance">
                                欢迎来到 NextCoding
                            </h1>
                            <p className="text-sm text-foreground/70">
                                在这里，你可以发布自己的编程作品。
                            </p>
                        </div>
                    </div>
                    <Button
                        size="lg"
                        variant="primary"
                        className="gap-2"
                        onPress={submitCreate}
                    >
                        <Plus className="size-4" />
                        创建作品
                    </Button>
                </div>
            </section>

            <section className="flex flex-col gap-4">
                <SectionHeading
                    title="推荐作品"
                    action={
                        <Link to="/discover">
                            <Button variant="ghost" size="sm">
                                查看全部
                            </Button>
                        </Link>
                    }
                />
                <FeaturedWorks />
            </section>
        </div>
    );
}
