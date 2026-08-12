import { Link } from "@tanstack/react-router";
import { Nav } from "./Sidebar/Nav";
import { UserInfo } from "./Sidebar/UserInfo";

export function Sidebar() {
    return (
        <aside className="sticky top-0 h-screen hidden md:flex md:w-64 text-foreground shrink-0 flex-col border-r border-default-100">
            <div className="w-full p-5 flex flex-col gap-10 overflow-y-auto flex-1 min-h-0">
                <Link
                    to="/"
                    className="flex items-center gap-2.5 w-fit"
                    preload="intent"
                >
                    <span className="text-xl font-bold tracking-tight">
                        NextCoding
                    </span>
                </Link>

                <Nav />
            </div>

            <div className="w-full p-5 border-t border-default-100">
                <UserInfo />
            </div>
        </aside>
    );
}
