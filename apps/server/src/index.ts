import { serve } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { works } from "./routes/works.js";

const app = new Hono();

app.use(cors());

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/works", works);

serve(
    {
        fetch: app.fetch,
        port: 3000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
