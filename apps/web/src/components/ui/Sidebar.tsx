import { Link } from "@tanstack/react-router";
import { Nav } from "./Sidebar/Nav";
import { UserInfo } from "./Sidebar/UserInfo";

export function Sidebar() {
    return (
        <aside className="sticky top-0 h-screen hidden md:flex md:w-64 text-foreground shrink-0 flex-col">
            {/* 站点标识 和 导航 */}
            <div className="w-full p-5 flex flex-col gap-10 overflow-y-auto flex-1 min-h-0">
                {/* 站点标识 */}
                <Link
                    to="/"
                    className="flex items-center gap-2.5 w-fit"
                    preload="intent"
                >
                    <img
                        src="/logo.png"
                        alt="NextCoding 吉祥物"
                        className="w-9 h-9 rounded-xl object-cover"
                    />
                    <span className="text-xl font-bold tracking-tight">
                        NextCoding
                    </span>
                </Link>

                {/* 导航 */}
                <Nav />
            </div>

            {/* 用户信息 */}
            <div className="w-full p-5">
                <UserInfo />
            </div>
        </aside>
    );
}
