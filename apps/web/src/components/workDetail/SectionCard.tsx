import { Card } from "@heroui/react";
import type { ComponentType, ReactNode } from "react";

interface SectionCardProps {
    title: string;
    icon: ComponentType<{ className?: string }>;
    children: ReactNode;
}

export function SectionCard({ title, icon: Icon, children }: SectionCardProps) {
    return (
        <Card className="shadow-none rounded-2xl border border-default-200/70">
            <Card.Header>
                <Card.Title className="text-sm font-bold flex items-center gap-3">
                    <Icon className="size-4 text-foreground/55" />
                    {title}
                </Card.Title>
            </Card.Header>
            <Card.Content>{children}</Card.Content>
        </Card>
    );
}
