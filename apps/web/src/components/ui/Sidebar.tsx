import { Nav } from "./Sidebar/Nav";
import { UserInfo } from "./Sidebar/UserInfo";

export function Sidebar() {
    return (
        <aside className="h-full hidden md:flex md:w-64 text-foreground shrink-0 overflow-y-auto">
            <div className="w-full p-5 flex flex-col justify-between">
                {/* 站点标识 和 导航 */}
                <div className="flex flex-col gap-10">
                    {/* 站点标识 */}
                    <div className="text-2xl font-bold">NextCoding</div>

                    {/* 导航 */}
                    <Nav />
                </div>

                {/* 用户数据 */}
                <UserInfo />
            </div>
        </aside>
    );
}
