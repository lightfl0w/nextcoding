import { checkAndUnlockAchievements } from "../achievements/checker.js";
import { insertActivity } from "../activities/repository.js";
import { getStorage } from "../storage/storageClient.js";
import { publishNewNotification } from "../works/notificationBus.js";
import { insertWork, insertWorkFiles } from "../works/repository.js";
import { insertNotification } from "../works/socialRepository.js";
import {
    bumpTemplateUseCount,
    findTemplate,
    insertTemplateUse,
} from "./repository.js";

export interface TemplateUseResult {
    id: string;
    title: string;
    files: number;
}

/**
 * 使用模板创建作品草稿：复制快照文件、登记派生记录、
 * 通知原作者并触发成就检查。
 * @param templateId - 模板 ID。
 * @param userId - 使用者 ID。
 * @throws 模板不存在或快照损坏时抛出 Error。
 */
export async function useTemplateForUser(
    templateId: string,
    userId: string,
): Promise<TemplateUseResult> {
    const tpl = await findTemplate(templateId);
    if (!tpl) {
        throw new Error("模板不存在");
    }
    if (tpl.status !== "published") {
        throw new Error("模板不存在");
    }

    const storage = getStorage();
    const raw = await storage.get(tpl.snapshotKey);
    if (!raw) {
        throw new Error("模板数据不存在");
    }

    let snapshot: {
        files?: Array<{
            name: string;
            content?: string;
            contentType?: string;
            encoding?: "base64";
        }>;
    };
    try {
        const text = new TextDecoder().decode(raw);
        snapshot = JSON.parse(text);
    } catch {
        throw new Error("模板数据格式错误");
    }

    const files = snapshot.files ?? [];
    const workId = crypto.randomUUID();

    await insertWork({
        id: workId,
        userId,
        title: tpl.title,
        description: tpl.description,
        tags: tpl.tags,
        status: "draft",
    });

    const workFiles = files.map((file) => {
        const key = `works/${workId}/files/${file.name}`;
        const bytes =
            file.encoding === "base64"
                ? new Uint8Array(Buffer.from(file.content ?? "", "base64"))
                : new TextEncoder().encode(file.content ?? "");
        return {
            key,
            name: file.name,
            size: bytes.length,
            contentType: file.contentType ?? null,
            bytes,
        };
    });

    await Promise.all(
        workFiles.map((f) =>
            storage.put(f.key, f.bytes, {
                contentType: f.contentType ?? undefined,
            }),
        ),
    );

    await insertWorkFiles(
        workFiles.map((f) => ({
            workId,
            key: f.key,
            name: f.name,
            size: f.size,
            contentType: f.contentType,
        })),
    );

    await insertTemplateUse({ templateId, workId, userId });
    await bumpTemplateUseCount(templateId);
    await insertActivity({
        userId,
        type: "template",
        actorId: userId,
        workId,
    });

    if (tpl.authorId && tpl.authorId !== userId) {
        await insertNotification({
            userId: tpl.authorId,
            type: "template",
            actorId: userId,
            workId,
        });
        await publishNewNotification(tpl.authorId);
        void checkAndUnlockAchievements(tpl.authorId).catch(() => {});
    }

    return { id: workId, title: tpl.title, files: workFiles.length };
}
