import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/discover")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div className="p-8">Hello "/discover"!</div>;
}
