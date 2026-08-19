import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Outlet, useLocation } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import "~/styles.css";
import { Providers } from "~/components/ThemeProviders";
import { MobileNav } from "~/components/ui/MobileNav";
import { Sidebar } from "~/components/ui/Sidebar";

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    const { pathname } = useLocation();
    const isAuthPage =
        pathname.startsWith("/auth") || pathname.startsWith("/reset-password");
    const isEditor = /^\/work\/[^/]+\/edit$/.test(pathname);
    const isTemplateEditor = pathname.startsWith("/templates/new");
    const isAdmin = pathname.startsWith("/admin");
    const fullscreen = isAuthPage || isEditor || isAdmin || isTemplateEditor;

    return (
        <div className="min-h-screen">
            <Providers>
                {fullscreen ? (
                    <div className="relative z-10 w-full">
                        <Outlet />
                    </div>
                ) : (
                    <main className="flex min-h-screen">
                        <div className="relative z-10 flex w-full">
                            <Sidebar />

                            <div className="flex-1 min-w-0 pb-20 md:pb-0">
                                <Outlet />
                            </div>
                        </div>
                        <MobileNav />
                    </main>
                )}
            </Providers>

            {import.meta.env.DEV && (
                <TanStackDevtools
                    config={{
                        position: "bottom-right",
                    }}
                    plugins={[
                        {
                            name: "TanStack Router",
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                    ]}
                />
            )}
        </div>
    );
}
