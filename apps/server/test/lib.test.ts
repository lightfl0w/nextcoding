import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { jsonError, readFlag, readJsonBody, readString, readTrimmed } from "../src/http/responses.js";
import { getStorage } from "../src/storage/storageClient.js";
import { decodePayload, fromBase64, fromText, isBinaryPayload, toBase64, toText } from "../src/works/content.js";
import { COMMENT_MAX_LENGTH, exceedsFileSizeLimit, fileSizeLimitMessage } from "../src/works/limits.js";
import { blobStorageKey, fileNameFromKey, fileStorageKey, isValidFileName, parseVersionNumber, snapshotStorageKey } from "../src/works/naming.js";
import { toComment, toNotification, toOwnedWork, toWorkDetail, toWorkSummary } from "../src/works/serializers.js";
import { captureFiles, decodeSnapshotFile, parseSnapshot, serializeSnapshot, snapshotFilesOf } from "../src/works/snapshot.js";
import { parseTags } from "../src/works/tags.js";
import { makeWorkFileRow } from "./helpers";
import { sha256Hex, storage } from "./setup";

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

        it("blobStorageKey 按作品与哈希组织", () => {
            expect(blobStorageKey("w1", "abc")).toBe("works/w1/blobs/abc");
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
        storage.store.clear();
        vi.mocked(getStorage).mockReturnValue({
            ...storage,
            get: vi.fn().mockResolvedValue(bytes),
        } as never);
    }

    describe("captureFiles", () => {
        it("写入内容寻址 blob 并以哈希引用", async () => {
            const bytes = new TextEncoder().encode("console.log(1)");
            storageReturning(bytes);
            const files = await captureFiles([makeWorkFileRow()]);
            const hash = sha256Hex(bytes);
            expect(files[0]).toEqual({
                key: "works/work-1/main.js",
                name: "main.js",
                contentType: "text/javascript",
                size: 14,
                hash,
            });
            expect(storage.store.get(`works/work-1/blobs/${hash}`)).toEqual(
                bytes,
            );
        });

        it("相同内容复用同一 blob", async () => {
            const bytes = new TextEncoder().encode("same");
            storageReturning(bytes);
            const files = await captureFiles([
                makeWorkFileRow(),
                makeWorkFileRow({
                    id: "file-2",
                    key: "works/work-1/b.js",
                    name: "b.js",
                }),
            ]);
            expect(files[0].hash).toBe(files[1].hash);
            expect(
                storage.store.has(`works/work-1/blobs/${files[0].hash}`),
            ).toBe(true);
        });

        it("存储中缺失的内容回退为空字节", async () => {
            storageReturning(null);
            const files = await captureFiles([makeWorkFileRow()]);
            expect(files[0].size).toBe(0);
            expect(files[0].hash).toBe(sha256Hex(new Uint8Array(0)));
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

