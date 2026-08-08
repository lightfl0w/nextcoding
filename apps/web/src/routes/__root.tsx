import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import "~/styles.css";
import { Providers } from "~/components/ThemeProviders";
import { Sidebar } from "~/components/ui/Sidebar";

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    return (
        <div className="min-h-screen">
            <main className="flex min-h-screen">
                <Providers>
                    <div className="relative z-10 flex w-full">
                        <Sidebar />

                        <div className="flex-1 min-w-0">
                            <Outlet />
                        </div>
                    </div>
                </Providers>
            </main>

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
        </div>
    );
}
