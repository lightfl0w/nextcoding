import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div className="p-8">Hello "/about"!</div>;
}
