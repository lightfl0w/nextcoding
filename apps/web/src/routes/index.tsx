import { Button } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { FeaturedWorks } from "~/components/FeaturedWorks";
import { SectionHeading } from "~/components/ui/SectionHeading";
import { useAuth } from "~/hooks/useAuth";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const submitCreate = () => {
        if (!isLoggedIn) {
            navigate({
                to: "/auth",
                search: { mode: "login", redirect: "/" },
            });
            return;
        }

        navigate({ to: "/work/new/edit" });
    };

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-8">
            <section className="relative overflow-hidden rounded-3xl border border-default-200/70 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/15 blur-3xl"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-secondary/10 blur-3xl"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle,var(--foreground)_1px,transparent_1px)] [background-size:22px_22px]"
                />
                <div className="relative z-10 px-8 py-12 flex flex-col items-start gap-6 fade-up">
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
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            size="lg"
                            variant="primary"
                            className="gap-2"
                            onPress={submitCreate}
                        >
                            <Plus className="size-4" />
                            创建作品
                        </Button>
                        <Link to="/discover">
                            <Button size="lg" variant="ghost">
                                发现作品
                            </Button>
                        </Link>
                    </div>
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
