import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./server";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL || "",
    plugins: [inferAdditionalFields<typeof auth>()],
});
