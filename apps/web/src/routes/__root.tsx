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
        <div className="h-screen bg-background">
            <main className="h-full flex">
                <Providers>
                    <div className="relative z-10 flex h-full w-full">
                        <Sidebar />

                        <Outlet />
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
