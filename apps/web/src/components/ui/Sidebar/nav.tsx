import { Button } from "@heroui/react";
import { Link, useRouterState } from "@tanstack/react-router";

type NavItem = {
    label: string;
    href: string;
};

export function Nav() {
    const pathname = useRouterState({
        select: (s) => s.location.pathname,
    });

    const navigation: NavItem[] = [
        { label: "首页", href: "/" },
        { label: "发现", href: "/discover" },
        { label: "关于", href: "/about" },
    ];

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <nav className="flex flex-col gap-2">
            {navigation.map((nav) => {
                const active = isActive(nav.href);

                return (
                    <Link key={nav.label} to={nav.href} preload="intent">
                        <Button
                            variant={active ? "tertiary" : "ghost"}
                            fullWidth
                            className="p-5 rounded-xl"
                            style={
                                active ? { color: "var(--accent)" } : undefined
                            }
                        >
                            <span className="flex-1 text-[15px] tracking-tight">
                                {nav.label}
                            </span>
                        </Button>
                    </Link>
                );
            })}
        </nav>
    );
}
