import { Card, Label } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Compass, Pencil, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "~/components/ui/PageHeader";
import { SectionHeading } from "~/components/ui/SectionHeading";

export const Route = createFileRoute("/about")({
    component: RouteComponent,
});

const features: { icon: ReactNode; title: string; desc: string }[] = [
    {
        icon: <Pencil className="size-5" />,
        title: "发布作品",
        desc: "把你写的小程序、小网页、小游戏变成看得见的作品，摆出来给大家瞧瞧！",
    },
    {
        icon: <Compass className="size-5" />,
        title: "发现灵感",
        desc: "翻翻最新最火的作品，说不定灵感就「啪」地一下冒出来啦～",
    },
    {
        icon: <Users className="size-5" />,
        title: "交流成长",
        desc: "和爱写代码的朋友们一起玩，一起变厉害，谁的代码不是从 Hello World 开始的呢！",
    },
];

function RouteComponent() {
    return (
        <div className="mx-auto w-full max-w-6xl p-8 flex flex-col gap-6">
            <PageHeader
                title="关于我们"
                description="吉祥物白羽带你看一看 NextCoding"
            />

            <Card className="w-full p-0 shadow-none rounded-2xl border border-default-200/70">
                <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo.png"
                            alt="NextCoding 吉祥物"
                            className="w-12 h-12 rounded-xl object-cover"
                        />
                        <div className="flex flex-col">
                            <Card.Title className="text-lg">
                                NextCoding
                            </Card.Title>
                            <Card.Description className="text-sm">
                                一个分享编程作品与灵感的社区
                            </Card.Description>
                        </div>
                    </div>

                    <Card.Content className="mt-2 flex flex-col gap-3 text-sm text-foreground/80 leading-relaxed">
                        <p>
                            嘿，你好呀！我是白羽，NextCoding 的吉祥物兼看板猫～
                            (=^･^=)
                        </p>
                        <p>
                            这里是给代码安家的小窝！你可以把自己做的小工具、小网页、小游戏挂出来给大家看，闲着的时候也能翻翻别人的作品——说不定就捡到超棒的点子啦！
                        </p>
                        <p>
                            别怕自己写得菜，谁还不是从 Hello World
                            开始的呢？快把你的作品挂出来，我在这儿等你哦！
                        </p>
                    </Card.Content>
                </div>
            </Card>

            <section className="flex flex-col gap-4">
                <SectionHeading title="我们的特色" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {features.map((feature) => (
                        <Card
                            key={feature.title}
                            className="p-0 shadow-none rounded-2xl border border-default-200/70 transition-colors hover:border-default-300"
                        >
                            <div className="p-5 flex flex-col gap-3">
                                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    {feature.icon}
                                </div>
                                <Card.Title className="text-base">
                                    {feature.title}
                                </Card.Title>
                                <Card.Description className="text-sm leading-relaxed">
                                    {feature.desc}
                                </Card.Description>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            <footer className="pt-2 pb-4 text-center flex flex-col gap-0.5">
                <Label className="text-xs text-foreground/50">NextCoding</Label>
                <p className="text-xs text-foreground/40">
                    分享编程作品与灵感的社区
                </p>
            </footer>
        </div>
    );
}
