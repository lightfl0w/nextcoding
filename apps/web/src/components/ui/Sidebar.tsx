import { Nav } from "./Sidebar/Nav";
import { UserInfo } from "./Sidebar/UserInfo";

export function Sidebar() {
    return (
        <aside className="sticky top-0 h-screen hidden md:flex md:w-64 text-foreground shrink-0 flex-col">
            {/* 站点标识 和 导航 */}
            <div className="w-full p-5 flex flex-col gap-10 overflow-y-auto flex-1 min-h-0">
                {/* 站点标识 */}
                <div className="text-2xl font-bold">NextCoding</div>

                {/* 导航 */}
                <Nav />
            </div>

            {/* 用户信息 */}
            <div className="w-full p-5 border-t border-foreground/10">
                <UserInfo />
            </div>
        </aside>
    );
}
