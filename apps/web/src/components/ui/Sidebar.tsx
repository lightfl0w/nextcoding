import { type FormEvent, useState } from "react";
import { Input } from "@heroui/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Nav } from "./Sidebar/Nav";
import { UserInfo } from "./Sidebar/UserInfo";

export function Sidebar() {
    const navigate = useNavigate();
    const [input, setInput] = useState("");

    const handleSearch = (event: FormEvent) => {
        event.preventDefault();
        const keyword = input.trim();
        navigate({ to: "/search", search: { q: keyword || undefined } });
    };

    return (
        <aside className="sticky top-0 h-screen hidden md:flex md:w-64 text-foreground shrink-0 flex-col bg-surface-secondary">
            <div className="w-full p-5 flex flex-col gap-6 overflow-y-auto flex-1 min-h-0">
                <Link
                    to="/"
                    className="flex items-center gap-2.5 w-fit"
                    preload="intent"
                >
                    <span className="text-xl font-bold tracking-tight">
                        NextCoding
                    </span>
                </Link>

                <form onSubmit={handleSearch} className="relative w-full" role="search">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/60" />
                    <Input
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="搜索作品…"
                        aria-label="搜索作品"
                        className="w-full pl-10 pr-9"
                    />
                    {input && (
                        <button
                            type="button"
                            onClick={() => setInput("")}
                            aria-label="清除搜索"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 transition-colors hover:bg-hover hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </form>

                <Nav />
            </div>

            <div className="w-full p-5 border-t border-default-100">
                <UserInfo />
            </div>
        </aside>
    );
}
