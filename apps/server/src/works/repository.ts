import {
    db,
    spark,
    user,
    work,
    workComment,
    workFile,
    workVersion,
} from "@nextcoding/db";
import { and, count, desc, eq, gte, inArray, like, sql } from "drizzle-orm";

export type WorkSort = "latest" | "popular" | "weekly";

export type WorkFileRow = typeof workFile.$inferSelect;

const summaryColumns = {
    id: work.id,
    title: work.title,
    description: work.description,
    coverUrl: work.coverUrl,
    tags: work.tags,
    views: work.views,
    likes: work.likes,
    sparks: work.sparks,
    createdAt: work.createdAt,
    authorId: user.id,
    authorName: user.name,
    authorImage: user.image,
    authorBio: user.bio,
};

const detailColumns = {
    ...summaryColumns,
    userId: work.userId,
    status: work.status,
    templateId: work.templateId,
    updatedAt: work.updatedAt,
};

const commentColumns = {
    id: workComment.id,
    content: workComment.content,
    parentId: workComment.parentId,
    createdAt: workComment.createdAt,
    authorId: user.id,
    authorName: user.name,
    authorImage: user.image,
    authorBio: user.bio,
};

const sortOrders = {
    popular: [desc(work.likes), desc(work.views), desc(work.createdAt)],
    latest: [desc(work.createdAt)],
} satisfies Record<"latest" | "popular", unknown[]>;

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

function sparkedColumn(userId?: string | null) {
    if (!userId) {
        return sql<number>`0`;
    }
    return sql<number>`exists(
        select 1 from spark
        where spark.work_id = ${work.id} and spark.user_id = ${userId}
    )`;
}

function followerCountColumn() {
    return sql<number>`(
        select count(*) from follow
        where follow.following_id = ${work.userId}
    )`;
}

function followingColumn(viewerId?: string | null) {
    if (!viewerId) {
        return sql<number>`0`;
    }
    return sql<number>`exists(
        select 1 from follow
        where follow.following_id = ${work.userId}
        and follow.follower_id = ${viewerId}
    )`;
}

function workSearchCondition(keyword: string) {
    const escaped = keyword.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const pattern = `%${escaped}%`;
    return sql`(
        ${work.title} like ${pattern} escape '\\'
        or ${work.description} like ${pattern} escape '\\'
        or ${work.tags} like ${pattern} escape '\\'
    )`;
}

export function listPublishedWorks(
    sort: WorkSort,
    limit: number,
    userId?: string | null,
    keyword?: string,
) {
    if (sort === "weekly") {
        return listWeeklyHotWorks(limit, userId, keyword);
    }
    return db
        .select({ ...summaryColumns, sparked: sparkedColumn(userId) })
        .from(work)
        .leftJoin(user, eq(work.userId, user.id))
        .where(
            and(
                eq(work.status, "published"),
                keyword ? workSearchCondition(keyword) : undefined,
            ),
        )
        .orderBy(...sortOrders[sort])
        .limit(limit);
}

/**
 * 某作者发布的全部作品（最新在前）。
 * @param authorId - 作者用户 ID。
 * @param limit - 返回数量上限。
 * @param viewerId - 当前查看者，用于计算 sparked。
 */
export function listUserPublishedWorks(
    authorId: string,
    limit: number,
    viewerId?: string | null,
) {
    return db
        .select({ ...summaryColumns, sparked: sparkedColumn(viewerId) })
        .from(work)
        .leftJoin(user, eq(work.userId, user.id))
        .where(and(eq(work.userId, authorId), eq(work.status, "published")))
        .orderBy(desc(work.createdAt))
        .limit(limit);
}

export function listWeeklyHotWorks(
    limit: number,
    userId?: string | null,
    keyword?: string,
) {
    const weekAgo = new Date(Date.now() - WEEK_IN_MS);
    return db
        .select({
            ...summaryColumns,
            sparkCount: count(spark.id),
            sparked: sparkedColumn(userId),
        })
        .from(work)
        .leftJoin(user, eq(work.userId, user.id))
        .leftJoin(
            spark,
            and(eq(spark.workId, work.id), gte(spark.createdAt, weekAgo)),
        )
        .where(
            and(
                eq(work.status, "published"),
                keyword ? workSearchCondition(keyword) : undefined,
            ),
        )
        .groupBy(work.id)
        .orderBy(desc(count(spark.id)), desc(work.createdAt))
        .limit(limit);
}

export function listOwnedWorks(userId: string, limit: number) {
    return db
        .select({
            id: work.id,
            title: work.title,
            status: work.status,
            sparks: work.sparks,
            views: work.views,
            createdAt: work.createdAt,
            updatedAt: work.updatedAt,
        })
        .from(work)
        .where(eq(work.userId, userId))
        .orderBy(desc(work.updatedAt))
        .limit(limit);
}

export async function findWorkDetail(workId: string, viewerId?: string | null) {
    const [row] = await db
        .select({
            ...detailColumns,
            followerCount: followerCountColumn(),
            isFollowing: followingColumn(viewerId),
        })
        .from(work)
        .leftJoin(user, eq(work.userId, user.id))
        .where(eq(work.id, workId));
    return row ?? null;
}

export async function findWorkOwnerId(workId: string) {
    const [row] = await db
        .select({ userId: work.userId })
        .from(work)
        .where(eq(work.id, workId));
    return row?.userId ?? null;
}

/**
 * 查询作品的访问控制信息（作者与发布状态）。
 * @param workId - 作品 ID。
 */
export async function findWorkAccess(workId: string) {
    const [row] = await db
        .select({ userId: work.userId, status: work.status })
        .from(work)
        .where(eq(work.id, workId));
    return row ?? null;
}

export async function findPublishedWorkOwnerId(workId: string) {
    const [row] = await db
        .select({ userId: work.userId })
        .from(work)
        .where(and(eq(work.id, workId), eq(work.status, "published")));
    return row?.userId ?? null;
}

export async function findWorkAuthor(workId: string) {
    const [row] = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(work)
        .innerJoin(user, eq(work.userId, user.id))
        .where(eq(work.id, workId));
    return row ?? null;
}

export async function workExists(workId: string) {
    const [row] = await db
        .select({ id: work.id })
        .from(work)
        .where(eq(work.id, workId))
        .limit(1);
    return row !== undefined;
}

export function insertWork(values: {
    id: string;
    userId: string;
    title: string;
    description: string | null;
    tags: string;
    status: "draft" | "published";
}) {
    return db.insert(work).values(values);
}

export function publishWork(workId: string) {
    return db
        .update(work)
        .set({ status: "published" })
        .where(eq(work.id, workId));
}

export function updateWorkTitle(workId: string, title: string) {
    return db.update(work).set({ title }).where(eq(work.id, workId));
}

export function listWorkFiles(workId: string) {
    return db.select().from(workFile).where(eq(workFile.workId, workId));
}

export async function findWorkFileByKey(workId: string, key: string) {
    const [row] = await db
        .select()
        .from(workFile)
        .where(and(eq(workFile.workId, workId), eq(workFile.key, key)))
        .limit(1);
    return row ?? null;
}

export async function mapWorkFilesByKey(workId: string, keys: string[]) {
    if (keys.length === 0) {
        return new Map<string, WorkFileRow>();
    }
    const rows = await db
        .select()
        .from(workFile)
        .where(and(eq(workFile.workId, workId), inArray(workFile.key, keys)));
    return new Map(rows.map((row) => [row.key, row]));
}

export function insertWorkFile(values: {
    workId: string;
    key: string;
    name: string;
    size: number;
    contentType: string | null;
}) {
    return db.insert(workFile).values({ id: crypto.randomUUID(), ...values });
}

export function insertWorkFiles(
    rows: Array<{
        workId: string;
        key: string;
        name: string;
        size: number;
        contentType: string | null;
    }>,
) {
    if (rows.length === 0) {
        return Promise.resolve();
    }
    return db
        .insert(workFile)
        .values(rows.map((row) => ({ id: crypto.randomUUID(), ...row })));
}

export function setWorkFileVersion(
    fileId: string,
    size: number,
    version: number,
) {
    return db
        .update(workFile)
        .set({ size, version })
        .where(eq(workFile.id, fileId));
}

export function bumpWorkFileVersion(fileId: string, size: number) {
    return db
        .update(workFile)
        .set({ size, version: sql`${workFile.version} + 1` })
        .where(eq(workFile.id, fileId));
}

export function deleteWorkFile(fileId: string) {
    return db.delete(workFile).where(eq(workFile.id, fileId));
}

export function renameWorkFile(fileId: string, key: string, name: string) {
    return db
        .update(workFile)
        .set({ key, name })
        .where(eq(workFile.id, fileId));
}

export function listWorkFilesByPrefix(workId: string, folder: string) {
    return db
        .select()
        .from(workFile)
        .where(
            and(
                eq(workFile.workId, workId),
                like(workFile.name, `${folder}/%`),
            ),
        );
}

export function deleteWorkFilesByIds(ids: string[]) {
    if (ids.length === 0) {
        return Promise.resolve();
    }
    return db.delete(workFile).where(inArray(workFile.id, ids));
}

export function listVersionSummaries(workId: string, limit: number) {
    return db
        .select({
            version: workVersion.version,
            message: workVersion.message,
            createdAt: workVersion.createdAt,
            tree: workVersion.tree,
            hash: workVersion.hash,
            parent: workVersion.parent,
            authorId: workVersion.userId,
            authorName: user.name,
        })
        .from(workVersion)
        .leftJoin(user, eq(workVersion.userId, user.id))
        .where(eq(workVersion.workId, workId))
        .orderBy(desc(workVersion.version))
        .limit(limit);
}

export function deleteVersion(workId: string, version: number) {
    return db
        .delete(workVersion)
        .where(
            and(
                eq(workVersion.workId, workId),
                eq(workVersion.version, version),
            ),
        );
}

export function renameVersionMessage(
    workId: string,
    version: number,
    message: string | null,
) {
    return db
        .update(workVersion)
        .set({ message })
        .where(
            and(
                eq(workVersion.workId, workId),
                eq(workVersion.version, version),
            ),
        );
}

export async function findVersion(workId: string, version: number) {
    const [row] = await db
        .select()
        .from(workVersion)
        .where(
            and(
                eq(workVersion.workId, workId),
                eq(workVersion.version, version),
            ),
        );
    return row ?? null;
}

export async function nextVersionNumber(workId: string) {
    const [row] = await db
        .select({
            highest: sql<number>`coalesce(max(${workVersion.version}), 0)`,
        })
        .from(workVersion)
        .where(eq(workVersion.workId, workId));
    return (row?.highest ?? 0) + 1;
}

export function insertVersion(values: {
    workId: string;
    version: number;
    snapshotKey: string;
    message: string | null;
    userId?: string | null;
    tree: string;
    hash: string;
    parent: string | null;
    createdAt: Date;
}) {
    return db
        .insert(workVersion)
        .values({ id: crypto.randomUUID(), ...values });
}

export function touchWork(workId: string) {
    return db
        .update(work)
        .set({ updatedAt: new Date() })
        .where(eq(work.id, workId));
}

export async function findWorkUpdatedAt(workId: string) {
    const [row] = await db
        .select({ updatedAt: work.updatedAt })
        .from(work)
        .where(eq(work.id, workId));
    return row?.updatedAt ?? null;
}

export function listComments(workId: string, limit: number) {
    return db
        .select(commentColumns)
        .from(workComment)
        .innerJoin(user, eq(workComment.userId, user.id))
        .where(eq(workComment.workId, workId))
        .orderBy(desc(workComment.createdAt))
        .limit(limit);
}

export async function findComment(commentId: string) {
    const [row] = await db
        .select({
            id: workComment.id,
            workId: workComment.workId,
            parentId: workComment.parentId,
            userId: workComment.userId,
        })
        .from(workComment)
        .where(eq(workComment.id, commentId))
        .limit(1);
    return row ?? null;
}

export async function insertComment(values: {
    workId: string;
    userId: string;
    parentId: string | null;
    content: string;
}) {
    const [row] = await db
        .insert(workComment)
        .values({ id: crypto.randomUUID(), ...values })
        .returning({ id: workComment.id, createdAt: workComment.createdAt });
    return row;
}
