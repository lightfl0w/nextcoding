import { Button, Card, Label } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FeaturedWorks } from "../components/FeaturedWorks";
import { useAuth } from "../hooks/useAuth";
import { createWork } from "../hooks/useCreateWork";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const handleCreate = async () => {
        if (!isLoggedIn) {
            navigate({
                to: "/auth",
                search: { mode: "login", redirect: "/" },
            });
            return;
        }
        const title = window.prompt("作品标题");
        if (!title?.trim()) return;
        try {
            const { id } = await createWork(title.trim());
            navigate({ to: "/work/$id/edit", params: { id } });
        } catch (err) {
            alert((err as Error).message);
        }
    };

    return (
        <div className="p-8 w-full flex flex-col gap-8 relative">
            <div className="relative z-10 flex flex-col gap-8">
                {/* 用于 欢迎 的卡片 */}
                <Card className="w-full p-0 shadow-none rounded-2xl">
                    <div className="p-6 flex flex-col gap-2">
                        <Card.Title className="text-xl">
                            欢迎使用 NextCoding
                        </Card.Title>
                        <Card.Description className="text-md">
                            欢迎使用NextCoding。在这里，你可以发布自己的编程作品。
                        </Card.Description>
                    </div>

                    <Card.Footer className="px-6 pb-6">
                        <Button onPress={handleCreate}>发布作品</Button>
                    </Card.Footer>
                </Card>

                {/* 推荐作品 */}
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-base">推荐作品</Label>
                        <Link to="/discover">
                            <Button variant="ghost" size="sm">
                                查看全部
                            </Button>
                        </Link>
                    </div>
                    <FeaturedWorks />
                </section>
            </div>
        </div>
    );
}
