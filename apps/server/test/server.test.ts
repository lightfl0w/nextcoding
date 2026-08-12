import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@nextcoding/auth", () => ({
    auth: { api: { getSession: vi.fn() } },
}));

vi.mock("../src/works/repository.js", () => ({
    bumpWorkFileVersion: vi.fn(),
    deleteWorkFile: vi.fn(),
    findComment: vi.fn(),
    findPublishedWorkOwnerId: vi.fn(),
    findVersion: vi.fn(),
    findWorkDetail: vi.fn(),
    findWorkFileByKey: vi.fn(),
    findWorkOwnerId: vi.fn(),
    insertComment: vi.fn(),
    insertVersion: vi.fn(),
    insertWork: vi.fn(),
    insertWorkFile: vi.fn(),
    insertWorkFiles: vi.fn(),
    listComments: vi.fn(),
    listOwnedWorks: vi.fn(),
    listPublishedWorks: vi.fn(),
    listVersionSummaries: vi.fn(),
    listWorkFiles: vi.fn(),
    mapWorkFilesByKey: vi.fn(),
    nextVersionNumber: vi.fn(),
    publishWork: vi.fn(),
    setWorkFileVersion: vi.fn(),
    updateWorkTitle: vi.fn(),
    workExists: vi.fn(),
}));

vi.mock("../src/works/socialRepository.js", () => ({
    NOTIFICATION_PAGE_SIZE: 100,
    bumpWorkSparks: vi.fn(),
    countUnreadNotifications: vi.fn(),
    findSourceByFork: vi.fn(),
    findSpark: vi.fn(),
    insertNotification: vi.fn(),
    insertRemix: vi.fn(),
    insertSpark: vi.fn(),
    listDirectRemixes: vi.fn(),
    listNotifications: vi.fn(),
    markAllNotificationsRead: vi.fn(),
}));

vi.mock("../src/users/repository.js", () => ({
    countGivenSparks: vi.fn(),
    countReceivedSparks: vi.fn(),
    deleteFollow: vi.fn(),
    findFollow: vi.fn(),
    findUserById: vi.fn(),
    insertFollow: vi.fn(),
}));

vi.mock("../src/storage/storageClient.js", () => ({
    getStorage: vi.fn(),
}));

import { auth } from "@nextcoding/auth";
import { type AuthenticatedEnv, requireSession } from "../src/http/guards.js";
import {
    jsonError,
    readFlag,
    readJsonBody,
    readString,
    readTrimmed,
} from "../src/http/responses.js";
import { storageRoutes } from "../src/storage/routes.js";
import { getStorage } from "../src/storage/storageClient.js";
import * as userRepo from "../src/users/repository.js";
import { userRoutes } from "../src/users/routes.js";
import {
    decodePayload,
    fromBase64,
    fromText,
    isBinaryPayload,
    toBase64,
    toText,
} from "../src/works/content.js";
import { requireWorkAuthor } from "../src/works/guards.js";
import {
    COMMENT_MAX_LENGTH,
    exceedsFileSizeLimit,
    fileSizeLimitMessage,
} from "../src/works/limits.js";
import {
    fileNameFromKey,
    fileStorageKey,
    isValidFileName,
    parseVersionNumber,
    snapshotStorageKey,
} from "../src/works/naming.js";
import * as workRepo from "../src/works/repository.js";
import { catalogRoutes } from "../src/works/routes/catalogRoutes.js";
import { commentRoutes } from "../src/works/routes/commentRoutes.js";
import { fileRoutes } from "../src/works/routes/fileRoutes.js";
import { notificationRoutes } from "../src/works/routes/notificationRoutes.js";
import { remixRoutes } from "../src/works/routes/remixRoutes.js";
import { sparkRoutes } from "../src/works/routes/sparkRoutes.js";
import { versionRoutes } from "../src/works/routes/versionRoutes.js";
import {
    toComment,
    toNotification,
    toOwnedWork,
    toWorkDetail,
    toWorkSummary,
} from "../src/works/serializers.js";
import {
    captureFiles,
    decodeSnapshotFile,
    parseSnapshot,
    serializeSnapshot,
    snapshotFilesOf,
} from "../src/works/snapshot.js";
import * as socialRepo from "../src/works/socialRepository.js";
import { parseTags } from "../src/works/tags.js";
import {
    createMemoryStorage,
    makeSession,
    makeWorkFileRow,
    makeWorkSummaryRow,
} from "./helpers";

const mockGetSession = vi.mocked(auth.api.getSession);
const storage = createMemoryStorage();

beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(makeSession());
    vi.mocked(getStorage).mockReturnValue(storage);
    storage.store.clear();
    storage.putCalls.length = 0;
});

describe("content 模块", () => {
    describe("isBinaryPayload", () => {
        it("根据 content-type 直接判定二进制类型", () => {
            expect(isBinaryPayload("image/png", fromText("x"))).toBe(true);
            expect(isBinaryPayload("application/pdf", fromText("x"))).toBe(
                true,
            );
            expect(isBinaryPayload("video/mp4", fromText("x"))).toBe(true);
            expect(isBinaryPayload("audio/mpeg", fromText("x"))).toBe(true);
            expect(
                isBinaryPayload("application/octet-stream", fromText("x")),
            ).toBe(true);
        });

        it("content-type 匹配时大小写不敏感", () => {
            expect(isBinaryPayload("Image/PNG", fromText("x"))).toBe(true);
            expect(isBinaryPayload("APPLICATION/PDF", fromText("x"))).toBe(
                true,
            );
        });

        it("文本 content-type 即使内容不可解码也不判二进制", () => {
            const bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
            expect(isBinaryPayload("text/plain", bytes)).toBe(false);
        });

        it("无 content-type 时按内容是否可解码为 UTF-8 判定", () => {
            expect(isBinaryPayload(null, fromText("你好"))).toBe(false);
            expect(
                isBinaryPayload(null, new Uint8Array([0xff, 0xfe, 0xfd])),
            ).toBe(true);
        });
    });

    describe("decodePayload", () => {
        it("非 base64 时直接编码为 UTF-8", () => {
            const result = decodePayload("console.log(1)", false);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(toText(result.bytes)).toBe("console.log(1)");
            }
        });

        it("合法 base64 正常解码", () => {
            const result = decodePayload("aGVsbG8=", true);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(toText(result.bytes)).toBe("hello");
            }
        });

        it("解码前会去掉首尾空白", () => {
            const result = decodePayload("  aGVsbG8=  ", true);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(toText(result.bytes)).toBe("hello");
            }
        });

        it("非法 base64 返回失败原因", () => {
            const invalid = ["abc", "aGVsbG8", "aGVs***=", "", "===="];
            for (const value of invalid) {
                const result = decodePayload(value, true);
                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.reason).toBe("base64 内容不合法");
                }
            }
        });
    });

    describe("编解码往返", () => {
        it("toBase64 / fromBase64 互逆", () => {
            const bytes = fromText("hello 世界");
            expect(fromBase64(toBase64(bytes))).toEqual(bytes);
        });

        it("toText / fromText 互逆", () => {
            expect(toText(fromText("hello 世界"))).toBe("hello 世界");
        });
    });
});

describe("naming 模块", () => {
    describe("isValidFileName", () => {
        it("接受普通文件名与多层路径", () => {
            expect(isValidFileName("main.js")).toBe(true);
            expect(isValidFileName("src/utils/helper.ts")).toBe(true);
        });

        it("拒绝空串、首尾斜杠与路径穿越", () => {
            expect(isValidFileName("")).toBe(false);
            expect(isValidFileName("/etc/passwd")).toBe(false);
            expect(isValidFileName("a/")).toBe(false);
            expect(isValidFileName(".")).toBe(false);
            expect(isValidFileName("..")).toBe(false);
            expect(isValidFileName("a/../b")).toBe(false);
            expect(isValidFileName("a/./b")).toBe(false);
            expect(isValidFileName("a//b")).toBe(false);
        });
    });

    describe("存储 key 生成", () => {
        it("fileStorageKey 拼接 workId 与文件名", () => {
            expect(fileStorageKey("w1", "src/main.js")).toBe(
                "works/w1/src/main.js",
            );
        });

        it("snapshotStorageKey 携带版本号", () => {
            expect(snapshotStorageKey("w1", 3)).toBe(
                "works/w1/snapshots/v3.json",
            );
        });

        it("fileNameFromKey 取最后一段", () => {
            expect(fileNameFromKey("works/w1/src/main.js")).toBe("main.js");
            expect(fileNameFromKey("main.js")).toBe("main.js");
        });
    });

    describe("parseVersionNumber", () => {
        it("解析合法正整数版本号", () => {
            expect(parseVersionNumber("1")).toBe(1);
            expect(parseVersionNumber("42")).toBe(42);
        });

        it("拒绝 0、负数、小数与非法字符", () => {
            expect(parseVersionNumber("0")).toBeNull();
            expect(parseVersionNumber("-1")).toBeNull();
            expect(parseVersionNumber("1.5")).toBeNull();
            expect(parseVersionNumber("abc")).toBeNull();
            expect(parseVersionNumber("")).toBeNull();
        });
    });
});

describe("limits 模块", () => {
    const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

    it("默认 20MB 限制：等于限制不超限", () => {
        expect(exceedsFileSizeLimit(DEFAULT_MAX_BYTES)).toBe(false);
    });

    it("默认 20MB 限制：超过限制超限", () => {
        expect(exceedsFileSizeLimit(DEFAULT_MAX_BYTES + 1)).toBe(true);
    });

    it("文件大小提示带/不带文件名", () => {
        expect(fileSizeLimitMessage("a.png")).toBe("文件 a.png 超过 20MB 限制");
        expect(fileSizeLimitMessage()).toBe("文件 超过 20MB 限制");
    });

    it("NC_MAX_FILE_SIZE_MB 环境变量覆盖限制", async () => {
        vi.stubEnv("NC_MAX_FILE_SIZE_MB", "1");
        vi.resetModules();
        const mod = await import("../src/works/limits.js");
        expect(mod.exceedsFileSizeLimit(1024 * 1024)).toBe(false);
        expect(mod.exceedsFileSizeLimit(1024 * 1024 + 1)).toBe(true);
        expect(mod.fileSizeLimitMessage()).toBe("文件 超过 1MB 限制");
        vi.unstubAllEnvs();
    });

    it("评论最大长度常量", () => {
        expect(COMMENT_MAX_LENGTH).toBe(500);
    });
});

describe("tags 模块", () => {
    it("null / 空串 / 空数组返回空数组", () => {
        expect(parseTags(null)).toEqual([]);
        expect(parseTags("")).toEqual([]);
        expect(parseTags("[]")).toEqual([]);
    });

    it("解析合法 JSON 数组并只保留字符串", () => {
        expect(parseTags('["js", "demo"]')).toEqual(["js", "demo"]);
        expect(parseTags('[1, "a", null, "b", {}]')).toEqual(["a", "b"]);
    });

    it("非法 JSON 与非数组结构返回空数组", () => {
        expect(parseTags("{bad json")).toEqual([]);
        expect(parseTags('"str"')).toEqual([]);
        expect(parseTags("{}")).toEqual([]);
    });
});

describe("serializers 模块", () => {
    function baseRow() {
        return {
            id: "work-1",
            title: "我的作品",
            description: "简介",
            coverUrl: "https://example.com/c.png",
            tags: JSON.stringify(["js", "demo"]),
            views: 10,
            likes: 2,
            sparks: 3,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            authorId: "user-1",
            authorName: "张三",
            authorImage: null,
            authorBio: "会写代码",
        };
    }

    describe("toWorkSummary", () => {
        it("解析 tags JSON 并聚合作者信息", () => {
            expect(toWorkSummary(baseRow())).toEqual({
                id: "work-1",
                title: "我的作品",
                description: "简介",
                coverUrl: "https://example.com/c.png",
                tags: ["js", "demo"],
                views: 10,
                likes: 2,
                sparks: 3,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                author: {
                    id: "user-1",
                    name: "张三",
                    image: null,
                    bio: "会写代码",
                },
            });
        });

        it("tags 为非法 JSON 时兜底为空数组", () => {
            const row = baseRow();
            row.tags = "{bad";
            expect(toWorkSummary(row).tags).toEqual([]);
        });
    });

    describe("toWorkDetail", () => {
        it("追加文件列表与关注状态", () => {
            const row = {
                ...baseRow(),
                userId: "user-1",
                status: "published" as const,
                updatedAt: new Date("2026-01-02T00:00:00Z"),
                followerCount: 7,
                isFollowing: 1,
            };
            const files = [{ key: "works/work-1/main.js" }];
            expect(toWorkDetail(row, files)).toMatchObject({
                userId: "user-1",
                status: "published",
                updatedAt: new Date("2026-01-02T00:00:00Z"),
                files,
                author: { followers: 7, followedByMe: true },
            });
        });

        it("关注字段缺失时默认 0 / false", () => {
            const row = {
                ...baseRow(),
                userId: "user-1",
                status: "draft" as const,
                updatedAt: new Date("2026-01-02T00:00:00Z"),
                followerCount: null,
                isFollowing: null,
            };
            const detail = toWorkDetail(row, []);
            expect(detail.author.followers).toBe(0);
            expect(detail.author.followedByMe).toBe(false);
        });
    });

    describe("toComment", () => {
        it("原样输出评论与作者", () => {
            const row = {
                id: "c1",
                content: "不错",
                parentId: null,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                authorId: "user-2",
                authorName: "李四",
                authorImage: null,
                authorBio: null,
            };
            expect(toComment(row)).toEqual({
                id: "c1",
                content: "不错",
                parentId: null,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                author: { id: "user-2", name: "李四", image: null, bio: null },
            });
        });
    });

    describe("toNotification", () => {
        function notificationRow(overrides: Record<string, unknown> = {}) {
            return {
                id: "n1",
                type: "spark" as const,
                read: false,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                actorId: "user-2",
                actorName: "李四",
                workId: "work-1",
                workTitle: "我的作品",
                commentId: null,
                commentContent: null,
                ...overrides,
            };
        }

        it("spark 通知携带 actor 与 work", () => {
            expect(toNotification(notificationRow())).toMatchObject({
                type: "spark",
                read: false,
                actor: { id: "user-2", name: "李四" },
                work: { id: "work-1", title: "我的作品" },
                comment: null,
            });
        });

        it("comment 通知携带评论内容", () => {
            const row = notificationRow({
                type: "comment",
                commentId: "c1",
                commentContent: "不错",
            });
            expect(toNotification(row).comment).toEqual({
                id: "c1",
                content: "不错",
            });
        });

        it("actor / work 缺失时折叠为 null", () => {
            const row = notificationRow({
                actorId: null,
                actorName: null,
                workId: null,
                workTitle: null,
            });
            expect(toNotification(row)).toMatchObject({
                actor: null,
                work: null,
            });
        });
    });

    describe("toOwnedWork", () => {
        it("原样输出我的作品字段", () => {
            const row = {
                id: "work-1",
                title: "草稿",
                status: "draft" as const,
                sparks: 0,
                views: 0,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                updatedAt: new Date("2026-01-02T00:00:00Z"),
            };
            expect(toOwnedWork(row)).toEqual(row);
        });
    });
});

describe("responses 模块", () => {
    it("jsonError 返回带错误信息的 JSON 与状态码", async () => {
        const app = new Hono().get("/", (c) => jsonError(c, "作品不存在", 404));
        const res = await app.request("/");
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "作品不存在" });
    });

    it("readJsonBody 解析合法 JSON 对象", async () => {
        const app = new Hono().post("/", async (c) => {
            const body = await readJsonBody(c);
            return c.json(body);
        });
        const res = await app.request("/", {
            method: "POST",
            body: JSON.stringify({ a: 1 }),
            headers: { "content-type": "application/json" },
        });
        expect(await res.json()).toEqual({ a: 1 });
    });

    it("readJsonBody 对数组 / 非法 JSON / 无 body 兜底为空对象", async () => {
        const app = new Hono().post("/", async (c) => {
            const body = await readJsonBody(c);
            return c.json(body);
        });
        const cases = [
            {
                body: JSON.stringify([1, 2]),
                headers: { "content-type": "application/json" },
            },
            {
                body: "not-json",
                headers: { "content-type": "application/json" },
            },
            {},
        ];
        for (const init of cases) {
            const res = await app.request("/", { method: "POST", ...init });
            expect(await res.json()).toEqual({});
        }
    });

    it("readString / readTrimmed / readFlag 按类型读取字段", async () => {
        const app = new Hono().post("/", async (c) => {
            const body = await readJsonBody(c);
            return c.json({
                s: readString(body, "s"),
                t: readTrimmed(body, "t"),
                f: readFlag(body, "f"),
                missing: readString(body, "missing"),
            });
        });
        const res = await app.request("/", {
            method: "POST",
            body: JSON.stringify({ s: "  x  ", t: "  标题  ", f: true }),
            headers: { "content-type": "application/json" },
        });
        expect(await res.json()).toEqual({
            s: "  x  ",
            t: "标题",
            f: true,
            missing: "",
        });
    });

    it("readFlag 仅接受严格等于 true", () => {
        expect(readFlag({ a: true }, "a")).toBe(true);
        expect(readFlag({ a: 1 }, "a")).toBe(false);
        expect(readFlag({}, "a")).toBe(false);
    });
});

describe("snapshot 模块", () => {
    function storageReturning(bytes: Uint8Array | null) {
        vi.mocked(getStorage).mockReturnValue({
            get: vi.fn().mockResolvedValue(bytes),
        } as never);
    }

    describe("captureFiles", () => {
        it("文本文件存为 UTF-8 文本", async () => {
            storageReturning(new TextEncoder().encode("console.log(1)"));
            const files = await captureFiles([makeWorkFileRow()]);
            expect(files).toEqual([
                {
                    key: "works/work-1/main.js",
                    name: "main.js",
                    contentType: "text/javascript",
                    content: "console.log(1)",
                },
            ]);
        });

        it("二进制文件存为 base64 并标记 encoding", async () => {
            const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            storageReturning(bytes);
            const files = await captureFiles([
                makeWorkFileRow({ contentType: "image/png" }),
            ]);
            expect(files[0]).toMatchObject({
                encoding: "base64",
                content: toBase64(bytes),
            });
        });

        it("存储中缺失的内容回退为空串", async () => {
            storageReturning(null);
            const files = await captureFiles([makeWorkFileRow()]);
            expect(files[0].content).toBe("");
            expect(files[0].encoding).toBeUndefined();
        });
    });

    it("serialize / parse 往返一致", () => {
        const snapshot = {
            version: 2,
            message: "更新",
            createdAt: 123,
            files: [
                { key: "k", name: "a.js", contentType: null, content: "x" },
            ],
        };
        expect(parseSnapshot(serializeSnapshot(snapshot))).toEqual(snapshot);
    });

    it("snapshotFilesOf 对 files 缺失兜底为空数组", () => {
        expect(
            snapshotFilesOf({
                version: 1,
                message: null,
                createdAt: 0,
            } as never),
        ).toEqual([]);
        expect(
            snapshotFilesOf({
                version: 1,
                message: null,
                createdAt: 0,
                files: [{ key: "k" }],
            }),
        ).toEqual([{ key: "k" }]);
    });

    describe("decodeSnapshotFile", () => {
        it("base64 文件解码为原始字节", () => {
            const bytes = new TextEncoder().encode("hello");
            const file = {
                key: "k",
                name: "a",
                contentType: null,
                content: toBase64(bytes),
                encoding: "base64" as const,
            };
            expect(decodeSnapshotFile(file)).toEqual(bytes);
        });

        it("纯文本文件按 UTF-8 解码", () => {
            const file = {
                key: "k",
                name: "a",
                contentType: null,
                content: "hello",
            };
            expect(decodeSnapshotFile(file)).toEqual(
                new TextEncoder().encode("hello"),
            );
        });

        it("content 缺失时按空串处理", () => {
            const file = {
                key: "k",
                name: "a",
                contentType: null,
                content: undefined,
            } as never;
            expect(decodeSnapshotFile(file)).toEqual(
                new TextEncoder().encode(""),
            );
        });
    });
});

describe("requireSession", () => {
    function buildApp() {
        const app = new Hono<AuthenticatedEnv>();
        app.use("/protected", requireSession);
        app.get("/protected", (c) =>
            c.json({ userId: c.get("userId"), userName: c.get("userName") }),
        );
        return app;
    }

    it("未登录返回 401", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await buildApp().request("/protected");
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "未登录" });
    });

    it("已登录时注入 userId 与 userName", async () => {
        mockGetSession.mockResolvedValue(
            makeSession({ id: "u1", name: "张三" }),
        );
        const res = await buildApp().request("/protected");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ userId: "u1", userName: "张三" });
    });

    it("登录用户无昵称时注入 null", async () => {
        mockGetSession.mockResolvedValue(makeSession({ id: "u1" }));
        const res = await buildApp().request("/protected");
        expect(await res.json()).toEqual({ userId: "u1", userName: null });
    });
});

describe("requireWorkAuthor", () => {
    function buildApp() {
        const app = new Hono<AuthenticatedEnv>();
        app.use("/w/:id/*", requireWorkAuthor);
        app.get("/w/:id/edit", (c) =>
            c.json({
                ok: true,
                userId: c.get("userId"),
                workId: c.req.param("id"),
            }),
        );
        return app;
    }

    it("未登录返回 401", async () => {
        mockGetSession.mockResolvedValue(null);
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-1");
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "未登录" });
    });

    it("作品不存在返回 404", async () => {
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue(null);
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "作品不存在" });
    });

    it("作者不符返回 403", async () => {
        mockGetSession.mockResolvedValue(makeSession({ id: "user-a" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-b");
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "无权操作" });
    });

    it("作者本人放行并注入用户信息", async () => {
        mockGetSession.mockResolvedValue(
            makeSession({ id: "user-a", name: "张三" }),
        );
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-a");
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            ok: true,
            userId: "user-a",
            workId: "work-1",
        });
    });

    it("携带作品 id 查询作者", async () => {
        mockGetSession.mockResolvedValue(makeSession({ id: "user-a" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-a");
        await buildApp().request("/w/work-42/edit");
        expect(workRepo.findWorkOwnerId).toHaveBeenCalledWith("work-42");
    });
});

describe("catalogRoutes", () => {
    function app() {
        return new Hono().route("/api/works", catalogRoutes);
    }

    describe("GET /api/works", () => {
        it("默认按 latest 排序并限制分页大小", async () => {
            mockGetSession.mockResolvedValue(null);
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([
                makeWorkSummaryRow({ id: "w1", sparked: 1 }),
            ]);
            const res = await app().request("/api/works?sort=bad&limit=1000");
            expect(res.status).toBe(200);
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "latest",
                100,
                null,
                undefined,
            );
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ id: "w1", sparked: true });
        });

        it("非法 limit 回退默认值", async () => {
            mockGetSession.mockResolvedValue(null);
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([]);
            await app().request("/api/works?limit=abc");
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "latest",
                20,
                null,
                undefined,
            );
        });

        it("keyword 去除首尾空白并截断到 64 字符", async () => {
            mockGetSession.mockResolvedValue(null);
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([]);
            const keyword = "x".repeat(100);
            await app().request(`/api/works?q=${keyword}`);
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "latest",
                20,
                null,
                "x".repeat(64),
            );
        });

        it("登录用户列表携带 viewerId", async () => {
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([]);
            await app().request("/api/works?sort=popular");
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "popular",
                20,
                "user-1",
                undefined,
            );
        });
    });

    describe("GET /api/works/mine", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/mine");
            expect(res.status).toBe(401);
        });

        it("返回我的作品列表", async () => {
            vi.mocked(workRepo.listOwnedWorks).mockResolvedValue([
                {
                    id: "w1",
                    title: "草稿",
                    status: "draft",
                    sparks: 0,
                    views: 0,
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    updatedAt: new Date("2026-01-02T00:00:00Z"),
                },
            ]);
            const res = await app().request("/api/works/mine");
            expect(res.status).toBe(200);
            expect(workRepo.listOwnedWorks).toHaveBeenCalledWith("user-1", 200);
            expect(await res.json()).toEqual([
                {
                    id: "w1",
                    title: "草稿",
                    status: "draft",
                    sparks: 0,
                    views: 0,
                    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
                    updatedAt: new Date("2026-01-02T00:00:00Z").toISOString(),
                },
            ]);
        });
    });

    describe("GET /api/works/:id", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("返回详情与文件列表", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue({
                ...makeWorkSummaryRow(),
                userId: "user-1",
                status: "published",
                updatedAt: new Date("2026-01-02T00:00:00Z"),
                followerCount: 2,
                isFollowing: 1,
            });
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            const res = await app().request("/api/works/work-1");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.id).toBe("work-1");
            expect(body.tags).toEqual(["js", "demo"]);
            expect(body.files).toEqual([]);
        });
    });

    describe("POST /api/works", () => {
        async function postWork(form: FormData) {
            return app().request("/api/works", { method: "POST", body: form });
        }

        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const form = new FormData();
            form.append("title", "标题");
            const res = await postWork(form);
            expect(res.status).toBe(401);
        });

        it("标题为空返回 400", async () => {
            const form = new FormData();
            form.append("title", "   ");
            const res = await postWork(form);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "标题不能为空" });
        });

        it("创建草稿并上传文件", async () => {
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            const form = new FormData();
            form.append("title", " 我的作品 ");
            form.append("description", "简介");
            form.append("tags", '["js"]');
            form.append(
                "files",
                new File(["console.log(1)"], "main.js", {
                    type: "text/javascript",
                }),
            );

            const res = await postWork(form);
            expect(res.status).toBe(201);
            const body = (await res.json()) as { id: string; files: number };
            expect(body.files).toBe(1);
            expect(workRepo.insertWork).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "我的作品",
                    status: "draft",
                    userId: "user-1",
                }),
            );
            expect(storage.store.has(`works/${body.id}/main.js`)).toBe(true);
            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    workId: body.id,
                    name: "main.js",
                    contentType: "text/javascript",
                }),
            ]);
        });

        it("非法文件名返回 400", async () => {
            const form = new FormData();
            form.append("title", "标题");
            form.append("files", new File(["x"], "../escape.js"));
            const res = await postWork(form);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "文件名不合法: ../escape.js",
            });
        });

        it("超过大小限制返回 400", async () => {
            const big = new Uint8Array(21 * 1024 * 1024);
            const form = new FormData();
            form.append("title", "标题");
            form.append("files", new File([big], "big.bin"));
            const res = await postWork(form);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "文件 big.bin 超过 20MB 限制",
            });
        });
    });

    describe("POST /api/works/:id/publish", () => {
        function asOwner() {
            mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
        }

        it("无文件不可发布", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "发布前请至少创建一个文件",
            });
        });

        it("文件均为空不可发布", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                {
                    id: "f1",
                    workId: "work-1",
                    key: "works/work-1/a.js",
                    name: "a.js",
                    size: 0,
                    contentType: null,
                    version: 1,
                    createdAt: new Date(),
                },
            ]);
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "请至少在一个文件里填写内容后再发布",
            });
        });

        it("有内容文件时发布成功", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                {
                    id: "f1",
                    workId: "work-1",
                    key: "works/work-1/a.js",
                    name: "a.js",
                    size: 10,
                    contentType: null,
                    version: 1,
                    createdAt: new Date(),
                },
            ]);
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                id: "work-1",
                status: "published",
            });
            expect(workRepo.publishWork).toHaveBeenCalledWith("work-1");
        });

        it("非作者不可发布", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(403);
        });
    });

    describe("PATCH /api/works/:id", () => {
        it("标题为空返回 400", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1", {
                method: "PATCH",
                body: JSON.stringify({ title: "  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
        });

        it("修改标题成功", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1", {
                method: "PATCH",
                body: JSON.stringify({ title: "  新标题  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ id: "work-1", title: "新标题" });
            expect(workRepo.updateWorkTitle).toHaveBeenCalledWith(
                "work-1",
                "新标题",
            );
        });
    });
});

describe("fileRoutes", () => {
    function app() {
        return new Hono().route("/api/works", fileRoutes);
    }

    function asOwner() {
        mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
    }

    describe("GET /:id/files", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(false);
            const res = await app().request("/api/works/work-1/files");
            expect(res.status).toBe(404);
        });

        it("返回文件列表", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow(),
            ]);
            const res = await app().request("/api/works/work-1/files");
            expect(res.status).toBe(200);
            const body = (await res.json()) as { files: unknown[] };
            expect(body.files).toHaveLength(1);
        });
    });

    describe("GET /:id/files/content", () => {
        it("缺少 key 返回 400", async () => {
            const res = await app().request("/api/works/work-1/files/content");
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "缺少 key" });
        });

        it("文件不存在返回 404", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/a.js",
            );
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "文件不存在" });
        });

        it("存储内容缺失返回 404", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/main.js",
            );
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "内容缺失" });
        });

        it("文本文件返回纯文本", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hi"),
            );
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/main.js",
            );
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("hi");
        });

        it("二进制文件返回 base64", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow({ contentType: "image/png" }),
            );
            const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            storage.store.set("works/work-1/main.js", bytes);
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/main.js",
            );
            expect(await res.text()).toBe(
                Buffer.from(bytes).toString("base64"),
            );
        });
    });

    describe("POST /:id/files", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({ name: "a.js", content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(403);
        });

        it("非法文件名返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({ name: "../a.js" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "文件名不合法" });
        });

        it("同名文件已存在返回 409", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({ name: "main.js", content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({ error: "同名文件已存在" });
        });

        it("非法 base64 内容返回 400", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({
                    name: "a.js",
                    content: "not-base64!!!",
                    isBase64: true,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "base64 内容不合法" });
        });

        it("创建成功写入存储与数据库", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({
                    name: "src/a.js",
                    content: "console.log(1)",
                    contentType: "text/javascript",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as {
                key: string;
                size: number;
                version: number;
            };
            expect(body).toMatchObject({
                key: "works/work-1/src/a.js",
                size: 14,
                version: 1,
            });
            expect(storage.store.get("works/work-1/src/a.js")).toEqual(
                new TextEncoder().encode("console.log(1)"),
            );
            expect(workRepo.insertWorkFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: "work-1",
                    key: "works/work-1/src/a.js",
                    name: "src/a.js",
                    size: 14,
                    contentType: "text/javascript",
                }),
            );
        });
    });

    describe("PUT /:id/files/content", () => {
        it("缺少 key 返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({ content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "缺少 key" });
        });

        it("文件不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({ key: "k", content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(404);
        });

        it("版本过期返回 409 与当前版本", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow({ version: 3 }),
            );
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({
                    key: "k",
                    content: "x",
                    expectedVersion: 2,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "文件已被他人修改，请刷新后重试",
                currentVersion: 3,
            });
        });

        it("expectedVersion 非整数视为过期", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({
                    key: "k",
                    content: "x",
                    expectedVersion: "abc",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
        });

        it("保存成功版本号递增", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    content: "hello!",
                    expectedVersion: 1,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                key: "works/work-1/main.js",
                size: 6,
                version: 2,
            });
            expect(workRepo.setWorkFileVersion).toHaveBeenCalledWith(
                "file-1",
                6,
                2,
            );
            expect(storage.store.get("works/work-1/main.js")).toEqual(
                new TextEncoder().encode("hello!"),
            );
        });
    });

    describe("DELETE /:id/files", () => {
        it("缺少 key 返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files", {
                method: "DELETE",
            });
            expect(res.status).toBe(400);
        });

        it("文件不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request(
                "/api/works/work-1/files?key=works/work-1/a.js",
                { method: "DELETE" },
            );
            expect(res.status).toBe(404);
        });

        it("删除成功清理存储与数据库", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("x"),
            );
            const res = await app().request(
                "/api/works/work-1/files?key=works/work-1/main.js",
                { method: "DELETE" },
            );
            expect(res.status).toBe(200);
            expect(storage.store.has("works/work-1/main.js")).toBe(false);
            expect(workRepo.deleteWorkFile).toHaveBeenCalledWith("file-1");
        });
    });
});

describe("versionRoutes", () => {
    function app() {
        return new Hono().route("/api/works", versionRoutes);
    }

    function asOwner() {
        mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
    }

    function makeVersionRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "v1",
            workId: "work-1",
            version: 1,
            snapshotKey: "works/work-1/snapshots/v1.json",
            message: "初版",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
    }

    describe("GET /:id/versions", () => {
        it("返回版本摘要列表", async () => {
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([
                { version: 2, message: "更新", createdAt: new Date() },
            ]);
            const res = await app().request("/api/works/work-1/versions");
            expect(res.status).toBe(200);
            expect(workRepo.listVersionSummaries).toHaveBeenCalledWith(
                "work-1",
                200,
            );
            expect(await res.json()).toHaveLength(1);
        });
    });

    describe("GET /:id/versions/:version", () => {
        it("非法版本号返回 400", async () => {
            for (const raw of ["0", "abc", "-1"]) {
                const res = await app().request(
                    `/api/works/work-1/versions/${raw}`,
                );
                expect(res.status).toBe(400);
                expect(await res.json()).toEqual({ error: "版本号不合法" });
            }
        });

        it("版本不存在返回 404", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/versions/9");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "版本不存在" });
        });

        it("快照数据丢失返回 500", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const res = await app().request("/api/works/work-1/versions/1");
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ error: "快照数据丢失" });
        });

        it("返回解析后的快照", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    { key: "k", name: "a.js", contentType: null, content: "x" },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            const res = await app().request("/api/works/work-1/versions/1");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(snapshot);
        });
    });

    describe("POST /:id/versions", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/versions", {
                method: "POST",
            });
            expect(res.status).toBe(403);
        });

        it("创建版本并写入快照与记录", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow({ size: 5 }),
            ]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(3);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hello"),
            );

            const res = await app().request("/api/works/work-1/versions", {
                method: "POST",
                body: JSON.stringify({ message: "  第三版  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({
                id: "work-1",
                version: 3,
                message: "第三版",
                fileCount: 1,
            });
            expect(workRepo.insertVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: "work-1",
                    version: 3,
                    snapshotKey: "works/work-1/snapshots/v3.json",
                    message: "第三版",
                }),
            );
            const stored = storage.store.get("works/work-1/snapshots/v3.json");
            expect(stored).toBeTruthy();
            const parsed = JSON.parse(new TextDecoder().decode(stored)) as {
                version: number;
                files: Array<{ content: string }>;
            };
            expect(parsed.version).toBe(3);
            expect(parsed.files[0].content).toBe("hello");
        });

        it("空 message 存为 null", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(1);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/versions", {
                method: "POST",
                body: JSON.stringify({ message: "   " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(workRepo.insertVersion).toHaveBeenCalledWith(
                expect.objectContaining({ message: null }),
            );
        });
    });

    describe("POST /:id/versions/:version/restore", () => {
        it("非法版本号返回 400", async () => {
            asOwner();
            const res = await app().request(
                "/api/works/work-1/versions/0/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(400);
        });

        it("版本不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(null);
            const res = await app().request(
                "/api/works/work-1/versions/9/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(404);
        });

        it("快照数据丢失返回 500", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const res = await app().request(
                "/api/works/work-1/versions/1/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(500);
        });

        it("已存在文件走版本递增，新文件走新增", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    {
                        key: "works/work-1/a.js",
                        name: "a.js",
                        contentType: null,
                        content: "aaa",
                    },
                    {
                        key: "works/work-1/b.js",
                        name: "b.js",
                        contentType: null,
                        content: "bbb",
                    },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            vi.mocked(workRepo.mapWorkFilesByKey).mockResolvedValue(
                new Map([
                    ["works/work-1/a.js", makeWorkFileRow({ id: "f-a" })],
                ]),
            );

            const res = await app().request(
                "/api/works/work-1/versions/1/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                restoredVersion: 1,
                files: 2,
            });
            expect(workRepo.bumpWorkFileVersion).toHaveBeenCalledWith("f-a", 3);
            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    workId: "work-1",
                    key: "works/work-1/b.js",
                    name: "b.js",
                    size: 3,
                }),
            ]);
            expect(storage.store.get("works/work-1/a.js")).toEqual(
                new TextEncoder().encode("aaa"),
            );
            expect(storage.store.get("works/work-1/b.js")).toEqual(
                new TextEncoder().encode("bbb"),
            );
        });
    });
});

describe("commentRoutes", () => {
    function app() {
        return new Hono().route("/api/works", commentRoutes);
    }

    function postComment(body: unknown) {
        return app().request("/api/works/work-1/comments", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
        });
    }

    describe("GET /:id/comments", () => {
        it("返回评论列表", async () => {
            vi.mocked(workRepo.listComments).mockResolvedValue([
                {
                    id: "c1",
                    content: "不错",
                    parentId: null,
                    createdAt: new Date(),
                    authorId: "u2",
                    authorName: "李四",
                    authorImage: null,
                    authorBio: null,
                },
            ]);
            const res = await app().request("/api/works/work-1/comments");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ id: "c1", content: "不错" });
        });
    });

    describe("POST /:id/comments", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await postComment({ content: "x" });
            expect(res.status).toBe(401);
        });

        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(false);
            const res = await postComment({ content: "x" });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("评论内容为空返回 400", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            const res = await postComment({ content: "   " });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "评论内容不能为空" });
        });

        it("评论超过 500 字返回 400", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            const res = await postComment({ content: "长".repeat(501) });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "评论最多 500 字" });
        });

        it("顶级评论成功且不产生通知", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({
                content: "写得真好",
                parentId: null,
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({
                id: "c-new",
                content: "写得真好",
                parentId: null,
                author: { id: "user-1", name: "张三" },
            });
            expect(workRepo.insertComment).toHaveBeenCalledWith({
                workId: "work-1",
                userId: "user-1",
                parentId: null,
                content: "写得真好",
            });
            expect(socialRepo.insertNotification).not.toHaveBeenCalled();
        });

        it("父评论不存在或不属于当前作品返回 400", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue(null);
            const res = await postComment({
                content: "回复",
                parentId: "ghost",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "父评论不存在" });
        });

        it("不允许回复二级评论", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue({
                id: "p1",
                workId: "work-1",
                parentId: "top",
                userId: "u2",
            });
            const res = await postComment({ content: "回复", parentId: "p1" });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "只能回复一级评论" });
        });

        it("回复他人评论时产生通知", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue({
                id: "p1",
                workId: "work-1",
                parentId: null,
                userId: "u2",
            });
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({ content: "回复", parentId: "p1" });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "u2",
                type: "comment",
                actorId: "user-1",
                workId: "work-1",
                commentId: "c-new",
            });
        });

        it("回复自己的评论不产生通知", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue({
                id: "p1",
                workId: "work-1",
                parentId: null,
                userId: "user-1",
            });
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({ content: "自回", parentId: "p1" });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).not.toHaveBeenCalled();
        });
    });
});

describe("sparkRoutes", () => {
    function app() {
        return new Hono().route("/api/works", sparkRoutes);
    }

    describe("GET /:id/spark", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/spark");
            expect(res.status).toBe(401);
        });

        it("返回是否已送过火花", async () => {
            vi.mocked(socialRepo.findSpark).mockResolvedValue({ id: "s1" });
            const res = await app().request("/api/works/work-1/spark");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ sparked: true });
            expect(socialRepo.findSpark).toHaveBeenCalledWith(
                "work-1",
                "user-1",
            );
        });
    });

    describe("POST /:id/spark", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                null,
            );
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("不能给自己的作品送火花", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "user-1",
            );
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "不能给自己的作品送火花",
            });
        });

        it("重复送火花返回 409", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "owner",
            );
            vi.mocked(socialRepo.findSpark).mockResolvedValue({ id: "s1" });
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "已经给这个作品送过火花了",
            });
        });

        it("送火花成功并通知作者", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "owner",
            );
            vi.mocked(socialRepo.findSpark).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ sparked: true });
            expect(socialRepo.insertSpark).toHaveBeenCalledWith({
                workId: "work-1",
                userId: "user-1",
            });
            expect(socialRepo.bumpWorkSparks).toHaveBeenCalledWith("work-1");
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "owner",
                type: "spark",
                actorId: "user-1",
                workId: "work-1",
            });
        });
    });
});

describe("remixRoutes", () => {
    function app() {
        return new Hono().route("/api/works", remixRoutes);
    }

    function publishedDetail() {
        return {
            ...makeWorkSummaryRow(),
            userId: "owner",
            status: "published" as const,
            updatedAt: new Date("2026-01-02T00:00:00Z"),
            followerCount: null,
            isFollowing: null,
            files: [],
        };
    }

    describe("POST /:id/remix", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(401);
        });

        it("原作品不存在或未发布返回 404", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("二创成功并复制文件", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(
                publishedDetail(),
            );
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                {
                    id: "f1",
                    workId: "work-1",
                    key: "works/work-1/main.js",
                    name: "main.js",
                    size: 5,
                    contentType: "text/javascript",
                    version: 1,
                    createdAt: new Date(),
                },
            ]);
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hello"),
            );

            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as { id: string; title: string };
            expect(body).toMatchObject({ title: "我的作品" });
            expect(workRepo.insertWork).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: body.id,
                    userId: "user-1",
                    title: "我的作品",
                    status: "draft",
                }),
            );
            expect(socialRepo.insertRemix).toHaveBeenCalledWith({
                originalId: "work-1",
                forkId: body.id,
                userId: "user-1",
            });
            expect(storage.store.has(`works/${body.id}/main.js`)).toBe(true);
        });

        it("二创他人作品时通知原作者", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(
                publishedDetail(),
            );
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as { id: string };
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "owner",
                type: "remix",
                actorId: "user-1",
                workId: body.id,
            });
        });

        it("二创自己的作品不产生通知", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue({
                ...publishedDetail(),
                userId: "user-1",
            });
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).not.toHaveBeenCalled();
        });
    });

    describe("GET /:id/source", () => {
        it("返回来源作品（可为 null）", async () => {
            vi.mocked(socialRepo.findSourceByFork).mockResolvedValue({
                id: "work-1",
                title: "原作",
            });
            const res = await app().request("/api/works/work-9/source");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ id: "work-1", title: "原作" });
        });
    });

    describe("GET /:id/remixes", () => {
        it("返回二创列表", async () => {
            vi.mocked(socialRepo.listDirectRemixes).mockResolvedValue([
                makeWorkSummaryRow({ id: "fork-1" }),
            ]);
            const res = await app().request("/api/works/work-1/remixes");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ id: "fork-1" });
        });
    });

    describe("GET /:id/tree", () => {
        it("同时返回来源与二创", async () => {
            vi.mocked(socialRepo.findSourceByFork).mockResolvedValue(null);
            vi.mocked(socialRepo.listDirectRemixes).mockResolvedValue([
                makeWorkSummaryRow({ id: "fork-1" }),
            ]);
            const res = await app().request("/api/works/work-1/tree");
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                source: null;
                remixes: unknown[];
            };
            expect(body.source).toBeNull();
            expect(body.remixes).toHaveLength(1);
        });
    });
});

describe("notificationRoutes", () => {
    function app() {
        return new Hono().route("/api/notifications", notificationRoutes);
    }

    function notificationRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "n1",
            type: "spark" as const,
            read: false,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            actorId: "u2",
            actorName: "李四",
            workId: "work-1",
            workTitle: "我的作品",
            commentId: null,
            commentContent: null,
            ...overrides,
        };
    }

    it("需要登录", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await app().request("/api/notifications");
        expect(res.status).toBe(401);
    });

    it("返回通知列表", async () => {
        vi.mocked(socialRepo.listNotifications).mockResolvedValue([
            notificationRow(),
        ]);
        const res = await app().request("/api/notifications");
        expect(res.status).toBe(200);
        expect(socialRepo.listNotifications).toHaveBeenCalledWith(
            "user-1",
            100,
        );
        const body = (await res.json()) as Array<Record<string, unknown>>;
        expect(body[0]).toMatchObject({
            id: "n1",
            type: "spark",
            actor: { id: "u2", name: "李四" },
        });
    });

    it("返回未读数", async () => {
        vi.mocked(socialRepo.countUnreadNotifications).mockResolvedValue(3);
        const res = await app().request("/api/notifications/unread-count");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ count: 3 });
    });

    it("全部标记已读", async () => {
        const res = await app().request("/api/notifications/read-all", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(socialRepo.markAllNotificationsRead).toHaveBeenCalledWith(
            "user-1",
        );
    });
});

describe("storageRoutes", () => {
    function app() {
        return new Hono().route("/api/storage", storageRoutes);
    }

    it("缺少 key 返回 400", async () => {
        const res = await app().request("/api/storage/");
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "缺少 key" });
    });

    it("文件不存在返回 404", async () => {
        const res = await app().request("/api/storage/missing.png");
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "文件不存在" });
    });

    it("按扩展名推断 content-type 并返回内容", async () => {
        storage.store.set(
            "avatars/u1/a.png",
            new TextEncoder().encode("png-bytes"),
        );
        const res = await app().request("/api/storage/avatars/u1/a.png");
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/png");
        expect(await res.text()).toBe("png-bytes");
    });

    it("存储 get 抛错时返回 500", async () => {
        vi.mocked(getStorage).mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error("s3 unavailable")),
        } as never);
        const res = await app().request("/api/storage/avatars/u1/a.png");
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "存储服务暂不可用" });
    });
});

describe("userRoutes", () => {
    function app() {
        return new Hono().route("/api/users", userRoutes);
    }

    describe("GET /me/stats", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/users/me/stats");
            expect(res.status).toBe(401);
        });

        it("返回送出与收到的火花数", async () => {
            vi.mocked(userRepo.countGivenSparks).mockResolvedValue(5);
            vi.mocked(userRepo.countReceivedSparks).mockResolvedValue(9);
            const res = await app().request("/api/users/me/stats");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                givenSparks: 5,
                receivedSparks: 9,
            });
        });
    });

    describe("POST /me/avatar", () => {
        function avatarRequest(file: File | null) {
            const form = new FormData();
            if (file) {
                form.append("file", file);
            }
            return app().request("/api/users/me/avatar", {
                method: "POST",
                body: form,
            });
        }

        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const form = new FormData();
            form.append(
                "file",
                new File(["x"], "a.png", { type: "image/png" }),
            );
            const res = await app().request("/api/users/me/avatar", {
                method: "POST",
                body: form,
            });
            expect(res.status).toBe(401);
        });

        it("缺少文件返回 400", async () => {
            const res = await avatarRequest(null);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "请选择上传的图片文件",
            });
        });

        it("不支持的图片格式返回 400", async () => {
            const res = await avatarRequest(
                new File(["x"], "a.gif.png", { type: "image/bmp" }),
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "不支持的图片格式，仅允许 JPG、PNG、WebP、GIF",
            });
        });

        it("超过 5MB 返回 400", async () => {
            const big = new Uint8Array(5 * 1024 * 1024 + 1);
            const res = await avatarRequest(
                new File([big], "big.png", { type: "image/png" }),
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "图片过大，不能超过 5 MB",
            });
        });

        it("上传成功返回 key 与可访问 url", async () => {
            const res = await avatarRequest(
                new File(["png-data"], "a.png", { type: "image/png" }),
            );
            expect(res.status).toBe(201);
            const body = (await res.json()) as { key: string; url: string };
            expect(body.key).toMatch(/^avatars\/user-1\/[a-f0-9]+\.png$/);
            expect(body.url).toBe(`/api/storage/${body.key}`);
            expect(storage.store.has(body.key)).toBe(true);
            expect(storage.putCalls[0].contentType).toBe("image/png");
        });

        it("上传成功后清理该用户的旧头像，不影响其他用户", async () => {
            storage.store.set(
                "avatars/user-1/old-1.png",
                new TextEncoder().encode("old"),
            );
            storage.store.set(
                "avatars/user-1/old-2.png",
                new TextEncoder().encode("old"),
            );
            storage.store.set(
                "avatars/user-2/a.png",
                new TextEncoder().encode("other"),
            );

            const res = await avatarRequest(
                new File(["png-data"], "a.png", { type: "image/png" }),
            );
            expect(res.status).toBe(201);
            const body = (await res.json()) as { key: string };

            expect(storage.store.has(body.key)).toBe(true);
            expect(storage.store.has("avatars/user-1/old-1.png")).toBe(false);
            expect(storage.store.has("avatars/user-1/old-2.png")).toBe(false);
            expect(storage.store.has("avatars/user-2/a.png")).toBe(true);
        });
    });

    describe("POST /:id/follow", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/users/u2/follow", {
                method: "POST",
            });
            expect(res.status).toBe(401);
        });

        it("目标用户不存在返回 404", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue(undefined);
            const res = await app().request("/api/users/ghost/follow", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "用户不存在" });
        });

        it("不能关注自己", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue({
                id: "user-1",
            });
            const res = await app().request("/api/users/user-1/follow", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "不能关注自己" });
        });

        it("重复关注返回 409", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue({ id: "u2" });
            vi.mocked(userRepo.findFollow).mockResolvedValue({ id: "f1" });
            const res = await app().request("/api/users/u2/follow", {
                method: "POST",
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({ error: "已经关注过了" });
        });

        it("关注成功", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue({ id: "u2" });
            vi.mocked(userRepo.findFollow).mockResolvedValue(undefined);
            const res = await app().request("/api/users/u2/follow", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ following: true });
            expect(userRepo.insertFollow).toHaveBeenCalledWith({
                followerId: "user-1",
                followingId: "u2",
            });
        });
    });

    describe("DELETE /:id/follow", () => {
        it("不能取关自己", async () => {
            const res = await app().request("/api/users/user-1/follow", {
                method: "DELETE",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "不能关注自己" });
        });

        it("取关成功", async () => {
            const res = await app().request("/api/users/u2/follow", {
                method: "DELETE",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ following: false });
            expect(userRepo.deleteFollow).toHaveBeenCalledWith("user-1", "u2");
        });
    });
});
