import { Toast } from "@heroui/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { SWRConfig } from "swr";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const SWR_CONFIG = {
    dedupingInterval: 2000,
    errorRetryCount: 3,
    keepPreviousData: true,
};

const rootElement = document.getElementById("app");

if (rootElement && !rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <SWRConfig value={SWR_CONFIG}>
            <Toast.Provider />
            <RouterProvider router={router} />
        </SWRConfig>,
    );
}
