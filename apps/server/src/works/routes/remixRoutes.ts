import { Hono } from "hono";
import { jsonError } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import { type AuthenticatedEnv, requireSession } from "../guards.js";
import { fileStorageKey } from "../naming.js";
import {
    findWorkDetail,
    insertWork,
    insertWorkFiles,
    listWorkFiles,
} from "../repository.js";
import { toWorkSummary } from "../serializers.js";
import {
    findSourceByFork,
    insertNotification,
    insertRemix,
    listDirectRemixes,
} from "../socialRepository.js";

export const remixRoutes = new Hono<AuthenticatedEnv>();

remixRoutes.post("/:id/remix", requireSession, async (c) => {
    const originalId = c.req.param("id");
    const userId = c.get("userId");

    const detail = await findWorkDetail(originalId);
    if (detail?.status !== "published") {
        return jsonError(c, "作品不存在", 404);
    }

    const forkId = crypto.randomUUID();
    await insertWork({
        id: forkId,
        userId,
        title: detail.title,
        description: detail.description,
        tags: detail.tags,
        status: "draft",
    });
    await copyFiles(originalId, forkId);
    await insertRemix({ originalId, forkId, userId });

    if (detail.userId !== userId) {
        await insertNotification({
            userId: detail.userId,
            type: "remix",
            actorId: userId,
            workId: forkId,
        });
    }

    return c.json({ id: forkId, title: detail.title }, 201);
});

remixRoutes.get("/:id/source", async (c) => {
    const source = await findSourceByFork(c.req.param("id"));
    return c.json(source);
});

remixRoutes.get("/:id/remixes", async (c) => {
    const remixes = await listDirectRemixes(c.req.param("id"));
    return c.json(remixes.map(toWorkSummary));
});

remixRoutes.get("/:id/tree", async (c) => {
    const workId = c.req.param("id");
    const [source, remixes] = await Promise.all([
        findSourceByFork(workId),
        listDirectRemixes(workId),
    ]);
    return c.json({ source, remixes: remixes.map(toWorkSummary) });
});

async function copyFiles(originalId: string, forkId: string) {
    const files = await listWorkFiles(originalId);
    const storage = getStorage();

    const copies = await Promise.all(
        files.map(async (file) => {
            const bytes = await storage.get(file.key);
            if (!bytes) return null;
            const newKey = fileStorageKey(forkId, file.name);
            await storage.put(newKey, bytes, {
                contentType: file.contentType ?? undefined,
            });
            return {
                workId: forkId,
                key: newKey,
                name: file.name,
                size: bytes.byteLength,
                contentType: file.contentType,
            };
        }),
    );

    await insertWorkFiles(
        copies.filter(
            (copy): copy is NonNullable<typeof copy> => copy !== null,
        ),
    );
}
