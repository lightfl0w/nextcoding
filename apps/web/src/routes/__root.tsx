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
        <div className="h-screen">
            <main className="h-full flex">
                <Providers>
                    <Sidebar />

                    <Outlet />
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
