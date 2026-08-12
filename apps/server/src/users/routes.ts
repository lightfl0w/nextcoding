import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import { getStorage } from "../storage/storageClient.js";
import {
    countGivenSparks,
    countReceivedSparks,
    deleteFollow,
    findFollow,
    findUserById,
    insertFollow,
} from "./repository.js";

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

function avatarStorageKey(userId: string, ext: string): string {
    const id = crypto.randomUUID().replace(/-/g, "");
    return `avatars/${userId}/${id}.${ext}`;
}

function publicStorageUrl(key: string): string {
    return `/api/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const userRoutes = new Hono<AuthenticatedEnv>()
    .get("/me/stats", requireSession, async (c) => {
        const userId = c.get("userId");
        const [givenSparks, receivedSparks] = await Promise.all([
            countGivenSparks(userId),
            countReceivedSparks(userId),
        ]);
        return c.json({ givenSparks, receivedSparks });
    })
    .post("/me/avatar", requireSession, async (c) => {
        const userId = c.get("userId");
        let form: FormData;
        try {
            form = await c.req.formData();
        } catch {
            return jsonError(c, "无效的表单数据", 400);
        }

        const file = form.get("file");
        if (!(file instanceof Blob) || file.size === 0) {
            return jsonError(c, "请选择上传的图片文件", 400);
        }
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            return jsonError(
                c,
                "不支持的图片格式，仅允许 JPG、PNG、WebP、GIF",
                400,
            );
        }
        if (file.size > MAX_AVATAR_SIZE) {
            return jsonError(c, "图片过大，不能超过 5 MB", 400);
        }

        const ext = EXT_BY_MIME[file.type];
        const key = avatarStorageKey(userId, ext);
        const storage = getStorage();
        await storage.put(key, file, { contentType: file.type });

        try {
            const prefix = `avatars/${userId}/`;
            const staleKeys = (await storage.list(prefix)).filter(
                (k) => k !== key,
            );
            await Promise.all(staleKeys.map((k) => storage.delete(k)));
        } catch (err) {
            console.error(`清理旧头像失败: ${userId}`, err);
        }

        return c.json({ key, url: publicStorageUrl(key) }, 201);
    })
    .post("/:id/follow", requireSession, async (c) => {
        const targetId = c.req.param("id");
        const actorId = c.get("userId");

        if (!(await findUserById(targetId))) {
            return jsonError(c, "用户不存在", 404);
        }
        if (targetId === actorId) {
            return jsonError(c, "不能关注自己", 400);
        }
        if (await findFollow(actorId, targetId)) {
            return jsonError(c, "已经关注过了", 409);
        }

        await insertFollow({ followerId: actorId, followingId: targetId });
        return c.json({ following: true });
    })
    .delete("/:id/follow", requireSession, async (c) => {
        const targetId = c.req.param("id");
        const actorId = c.get("userId");

        if (targetId === actorId) {
            return jsonError(c, "不能关注自己", 400);
        }

        await deleteFollow(actorId, targetId);
        return c.json({ following: false });
    });
