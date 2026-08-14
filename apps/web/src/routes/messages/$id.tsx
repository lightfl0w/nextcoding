import { createFileRoute, useParams } from "@tanstack/react-router";
import { ConversationView } from "~/components/messages/ConversationView";

export const Route = createFileRoute("/messages/$id")({
    component: ConversationRoute,
});

function ConversationRoute() {
    const { id } = useParams({ from: "/messages/$id" });
    return <ConversationView conversationId={id} />;
}
